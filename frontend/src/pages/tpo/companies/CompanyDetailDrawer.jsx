import React, { useState, useEffect, useCallback } from "react";
import {
  X,
  Building2,
  Globe,
  Briefcase,
  Users,
  Plus,
  Trash2,
  ExternalLink,
  Calendar,
  IndianRupee,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Edit2,
} from "lucide-react";
import {
  getCompanyJobRolesApi,
  createCompanyJobRoleApi,
  deleteJobRoleApi,
  getCompanyPlacementsApi,
} from "../../../api/companies";

export default function CompanyDetailDrawer({
  company,
  isOpen,
  onClose,
  onEditCompany,
  onCompanyUpdated,
}) {
  const [activeTab, setActiveTab] = useState("roles"); // 'roles' | 'placements'

  // Job Roles State
  const [jobRoles, setJobRoles] = useState([]);
  const [isLoadingRoles, setIsLoadingRoles] = useState(false);
  const [roleError, setRoleError] = useState(null);

  // New Role Form State
  const [showAddRoleForm, setShowAddRoleForm] = useState(false);
  const [newRoleTitle, setNewRoleTitle] = useState("");
  const [newRoleDomain, setNewRoleDomain] = useState("");
  const [newRoleDescription, setNewRoleDescription] = useState("");
  const [isSubmittingRole, setIsSubmittingRole] = useState(false);

  // Placements State
  const [placements, setPlacements] = useState([]);
  const [isLoadingPlacements, setIsLoadingPlacements] = useState(false);
  const [placementError, setPlacementError] = useState(null);

  const fetchJobRoles = useCallback(async () => {
    if (!company?.id) return;
    setIsLoadingRoles(true);
    setRoleError(null);
    try {
      const res = await getCompanyJobRolesApi(company.id);
      setJobRoles(res.data || []);
    } catch (err) {
      setRoleError(err.message || "Failed to load company job roles.");
    } finally {
      setIsLoadingRoles(false);
    }
  }, [company?.id]);

  const fetchPlacements = useCallback(async () => {
    if (!company?.id) return;
    setIsLoadingPlacements(true);
    setPlacementError(null);
    try {
      const res = await getCompanyPlacementsApi(company.id, { limit: 50 });
      setPlacements(res.data || []);
    } catch (err) {
      setPlacementError(err.message || "Failed to load placement records.");
    } finally {
      setIsLoadingPlacements(false);
    }
  }, [company?.id]);

  useEffect(() => {
    if (isOpen && company?.id) {
      setShowAddRoleForm(false);
      setNewRoleTitle("");
      setNewRoleDomain("");
      setNewRoleDescription("");
      if (activeTab === "roles") {
        fetchJobRoles();
      } else {
        fetchPlacements();
      }
    }
  }, [isOpen, company?.id, activeTab, fetchJobRoles, fetchPlacements]);

  if (!isOpen || !company) return null;

  const handleCreateJobRole = async (e) => {
    e.preventDefault();
    if (!newRoleTitle.trim()) {
      setRoleError("Job role title is required.");
      return;
    }

    setIsSubmittingRole(true);
    setRoleError(null);
    try {
      await createCompanyJobRoleApi(company.id, {
        title: newRoleTitle.trim(),
        domain: newRoleDomain.trim() || null,
        description: newRoleDescription.trim() || null,
      });
      setNewRoleTitle("");
      setNewRoleDomain("");
      setNewRoleDescription("");
      setShowAddRoleForm(false);
      await fetchJobRoles();
      if (onCompanyUpdated) onCompanyUpdated();
    } catch (err) {
      setRoleError(err.message || "Failed to create job role.");
    } finally {
      setIsSubmittingRole(false);
    }
  };

  const handleDeleteJobRole = async (roleId) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this job role? This cannot be undone."
    );
    if (!confirmed) return;

    try {
      await deleteJobRoleApi(roleId);
      await fetchJobRoles();
      if (onCompanyUpdated) onCompanyUpdated();
    } catch (err) {
      alert(err.message || "Cannot delete this job role.");
    }
  };

  const initials = company.name
    ? company.name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "CO";

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-2xs flex justify-end">
      <div
        className="relative w-full max-w-xl bg-white border-l border-[#111827] shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Drawer Header */}
        <div className="p-5 bg-[#111827] text-white border-b border-gray-800 flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded bg-gray-800 border border-gray-700 text-[#FECC00] font-bold text-base flex items-center justify-center shrink-0">
              {initials}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  {company.name}
                </h2>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    company.isActive
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : "bg-gray-700 text-gray-400 border border-gray-600"
                  }`}
                >
                  {company.isActive ? "Active Partner" : "Inactive"}
                </span>
              </div>

              {company.website && (
                <a
                  href={company.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-[#FECC00] mt-1 transition font-mono"
                >
                  <span>{company.website.replace(/^https?:\/\//, "")}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onEditCompany(company)}
              className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-gray-800 transition cursor-pointer"
              title="Edit Company"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-gray-800 transition cursor-pointer"
              title="Close Drawer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Company Description Overview */}
        {company.description && (
          <div className="px-5 py-3 bg-slate-50 border-b border-[#E5E7EB] text-xs text-gray-600">
            {company.description}
          </div>
        )}

        {/* Drawer Tabs */}
        <div className="flex border-b border-[#E5E7EB] bg-white px-5 pt-3">
          <button
            type="button"
            onClick={() => setActiveTab("roles")}
            className={`inline-flex items-center gap-2 pb-2.5 text-xs font-semibold border-b-2 mr-6 transition cursor-pointer ${
              activeTab === "roles"
                ? "border-[#111827] text-[#111827]"
                : "border-transparent text-gray-500 hover:text-gray-900"
            }`}
          >
            <Briefcase className="w-4 h-4" />
            <span>Job Roles &amp; Profiles</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-gray-700 font-mono">
              {jobRoles.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("placements")}
            className={`inline-flex items-center gap-2 pb-2.5 text-xs font-semibold border-b-2 transition cursor-pointer ${
              activeTab === "placements"
                ? "border-[#111827] text-[#111827]"
                : "border-transparent text-gray-500 hover:text-gray-900"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Campus Placements Hired</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-gray-700 font-mono">
              {placements.length}
            </span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {activeTab === "roles" ? (
            <div className="space-y-4">
              {/* Add Job Role Button / Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-[#111827] uppercase tracking-wider">
                    Registered Job Profiles
                  </h3>
                  <p className="text-[11px] text-gray-500">
                    Roles available when creating drives for {company.name}.
                  </p>
                </div>
                {!showAddRoleForm && (
                  <button
                    type="button"
                    onClick={() => setShowAddRoleForm(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#111827] text-white hover:bg-black text-xs font-medium transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#FECC00]" />
                    <span>Add Job Role</span>
                  </button>
                )}
              </div>

              {roleError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                  <span>{roleError}</span>
                </div>
              )}

              {/* Inline Add Role Form */}
              {showAddRoleForm && (
                <form
                  onSubmit={handleCreateJobRole}
                  className="bg-slate-50 border border-[#E5E7EB] rounded p-4 space-y-3 animate-in fade-in-50 duration-150"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                    <span className="text-xs font-bold text-[#111827]">
                      New Job Role Details
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowAddRoleForm(false)}
                      className="text-gray-400 hover:text-gray-600 p-0.5"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold text-gray-700">
                      Role Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={newRoleTitle}
                      onChange={(e) => setNewRoleTitle(e.target.value)}
                      placeholder="e.g., Software Development Engineer, QA Analyst"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-[#E5E7EB] rounded focus:outline-none focus:border-[#111827]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold text-gray-700">
                      Technical Domain
                    </label>
                    <input
                      type="text"
                      value={newRoleDomain}
                      onChange={(e) => setNewRoleDomain(e.target.value)}
                      placeholder="e.g., Full Stack Web, Embedded Systems, Cloud Infrastructure"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-[#E5E7EB] rounded focus:outline-none focus:border-[#111827]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold text-gray-700">
                      Description &amp; Skill Requirements
                    </label>
                    <textarea
                      rows={2}
                      value={newRoleDescription}
                      onChange={(e) => setNewRoleDescription(e.target.value)}
                      placeholder="Key competencies, technologies, or job requirements..."
                      className="w-full p-2 text-xs bg-white border border-[#E5E7EB] rounded focus:outline-none focus:border-[#111827]"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200">
                    <button
                      type="button"
                      onClick={() => setShowAddRoleForm(false)}
                      disabled={isSubmittingRole}
                      className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-200 rounded transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingRole}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-[#111827] bg-[#FECC00] hover:bg-[#e5b800] rounded transition cursor-pointer disabled:opacity-50"
                    >
                      {isSubmittingRole ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      )}
                      <span>Save Job Role</span>
                    </button>
                  </div>
                </form>
              )}

              {/* Roles List */}
              {isLoadingRoles ? (
                <div className="p-8 text-center text-xs text-gray-500">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-[#111827]" />
                  <span>Loading registered job roles...</span>
                </div>
              ) : jobRoles.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-500 bg-slate-50 border border-dashed border-[#E5E7EB] rounded">
                  No job roles registered yet for {company.name}. Click &quot;Add Job Role&quot; above to create one.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {jobRoles.map((role) => (
                    <div
                      key={role.id}
                      className="p-3.5 bg-white border border-[#E5E7EB] rounded space-y-2 shadow-2xs hover:border-gray-400 transition"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-bold text-xs text-[#111827]">
                            {role.title}
                          </div>
                          {role.domain && (
                            <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                              {role.domain}
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteJobRole(role.id)}
                          className="text-gray-400 hover:text-red-600 p-1 rounded transition cursor-pointer"
                          title="Delete Job Role"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {role.description && (
                        <p className="text-[11px] text-gray-600 leading-relaxed">
                          {role.description}
                        </p>
                      )}

                      <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-[10px] text-gray-400">
                        <span>
                          Drives Linked:{" "}
                          <strong className="text-gray-700 font-mono">
                            {role._count?.placementDrives ?? 0}
                          </strong>
                        </span>
                        <span className="font-mono">ID: #{role.id}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <h3 className="text-xs font-bold text-[#111827] uppercase tracking-wider">
                  Campus Hires Roster
                </h3>
                <p className="text-[11px] text-gray-500">
                  Verified student selections hired by {company.name}.
                </p>
              </div>

              {placementError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                  {placementError}
                </div>
              )}

              {isLoadingPlacements ? (
                <div className="p-8 text-center text-xs text-gray-500">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-[#111827]" />
                  <span>Loading placement history...</span>
                </div>
              ) : placements.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-500 bg-slate-50 border border-dashed border-[#E5E7EB] rounded">
                  No verified placements recorded for {company.name} yet.
                </div>
              ) : (
                <div className="border border-[#E5E7EB] rounded overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F8FAFC] border-b border-[#E5E7EB] text-gray-500 text-[11px] uppercase tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3 font-semibold">Candidate</th>
                        <th className="py-2.5 px-3 font-semibold">Role</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Package</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {placements.map((p) => {
                        const studentUser = p.student?.user;
                        const pkg = p.packageLPA
                          ? `₹${Number(p.packageLPA).toFixed(2)} LPA`
                          : "—";

                        return (
                          <tr key={p.id} className="hover:bg-slate-50 transition">
                            <td className="py-2.5 px-3">
                              <div className="font-semibold text-gray-900">
                                {studentUser?.name || "Student"}
                              </div>
                              <div className="text-[11px] font-mono text-gray-500">
                                {p.student?.PRN} • {p.student?.department?.code}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-gray-600">
                              {p.drive?.jobRole?.title || p.drive?.title || "Hired"}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-[#111827] tabular-nums">
                              {pkg}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-50 text-emerald-800 border border-emerald-200">
                                {p.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="p-3 bg-slate-50 border-t border-[#E5E7EB] text-center text-[11px] text-gray-400">
          DKTE Central Training &amp; Placement Cell • Corporate CRM Records
        </div>
      </div>
    </div>
  );
}

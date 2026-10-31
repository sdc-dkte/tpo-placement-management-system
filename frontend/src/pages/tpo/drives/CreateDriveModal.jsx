import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Plus,
  Building2,
  Briefcase,
  IndianRupee,
  Calendar,
  MapPin,
  GraduationCap,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import {
  getCompaniesForSelectApi,
  getCompanyJobRolesForSelectApi,
  createCompanyQuickApi,
  createJobRoleQuickApi,
  getDepartmentsForSelectApi,
  createDriveApi,
} from "../../../api/drives";

/**
 * Accessible <60s Clean Placement Drive Creation Modal
 * Adheres strictly to DKTE rules:
 * - No package tiers (purely monetary CTC format)
 * - Simple venue descriptors (no lab terminal tracking)
 * - Zero bloat (direct fields, fast completion)
 */
export default function CreateDriveModal({ isOpen, onClose, onDriveCreated }) {
  const dialogRef = useRef(null);

  // Reference data
  const [companies, setCompanies] = useState([]);
  const [jobRoles, setJobRoles] = useState([]);
  const [departments, setDepartments] = useState([]);

  // Form state
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [selectedJobRoleId, setSelectedJobRoleId] = useState("");
  const [driveTitle, setDriveTitle] = useState("");
  const [packageLPA, setPackageLPA] = useState("");
  const [driveDate, setDriveDate] = useState("");
  const [venue, setVenue] = useState("DKTE Main Auditorium & Seminar Complex");
  const [hiringProcess] = useState("Online Aptitude -> Technical Interview -> HR Round");

  // Academic Criteria
  const [minCGPA, setMinCGPA] = useState("7.50");
  const [maxBacklogs, setMaxBacklogs] = useState("0");
  const [minTenth, setMinTenth] = useState("60.00");
  const [minTwelfth, setMinTwelfth] = useState("65.00");
  const [minDiploma, setMinDiploma] = useState("65.00");
  const [selectedDeptIds, setSelectedDeptIds] = useState([]);
  const [graduationYear, setGraduationYear] = useState(2026);

  // Quick inline creation states
  const [isAddingCompany, setIsAddingCompany] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [isAddingRole, setIsAddingRole] = useState(false);
  const [newRoleTitle, setNewRoleTitle] = useState("");

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  // Sync native <dialog> with isOpen prop
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [isOpen]);

  // Load companies & departments on open
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    async function loadMetadata() {
      try {
        const [compRes, deptRes] = await Promise.all([
          getCompaniesForSelectApi().catch(() => ({ data: [] })),
          getDepartmentsForSelectApi().catch(() => ({ data: [] })),
        ]);

        if (isMounted) {
          const comps = compRes?.data || [];
          setCompanies(comps);

          const depts = deptRes?.data || [];
          setDepartments(depts);

          // Default select all departments if empty
          setSelectedDeptIds((prev) =>
            prev.length === 0 && depts.length > 0 ? depts.map((d) => d.id) : prev
          );

          // If companies exist and none selected, auto-select first
          setSelectedCompanyId((prev) =>
            !prev && comps.length > 0 ? String(comps[0].id) : prev
          );
        }
      } catch (err) {
        console.error("Error loading drive metadata:", err);
      }
    }

    loadMetadata();
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Load job roles when company changes
  useEffect(() => {
    if (!selectedCompanyId) {
      setJobRoles([]);
      setSelectedJobRoleId("");
      return;
    }

    let isMounted = true;
    async function loadRoles() {
      try {
        const res = await getCompanyJobRolesForSelectApi(selectedCompanyId);
        if (isMounted) {
          const roles = res?.data || [];
          setJobRoles(roles);
          if (roles.length > 0) {
            setSelectedJobRoleId(String(roles[0].id));
            // Auto update drive title
            const companyObj = companies.find((c) => String(c.id) === selectedCompanyId);
            if (companyObj) {
              setDriveTitle(`${companyObj.name} — ${roles[0].title}`);
            }
          } else {
            setSelectedJobRoleId("");
          }
        }
      } catch (err) {
        console.error("Error loading job roles:", err);
      }
    }

    loadRoles();
    return () => {
      isMounted = false;
    };
  }, [selectedCompanyId, companies]);

  // Quick Add Company
  const handleQuickAddCompany = async (e) => {
    e.preventDefault();
    if (!newCompanyName.trim()) return;

    try {
      const res = await createCompanyQuickApi({
        name: newCompanyName.trim(),
        website: `https://${newCompanyName.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`,
      });
      const created = res?.data;
      if (created) {
        setCompanies((prev) => [...prev, created]);
        setSelectedCompanyId(String(created.id));
        setNewCompanyName("");
        setIsAddingCompany(false);
      }
    } catch (err) {
      setFormError(err.message || "Failed to create company.");
    }
  };

  // Quick Add Role
  const handleQuickAddRole = async (e) => {
    e.preventDefault();
    if (!newRoleTitle.trim() || !selectedCompanyId) return;

    try {
      const res = await createJobRoleQuickApi(selectedCompanyId, {
        title: newRoleTitle.trim(),
        domain: "Engineering",
      });
      const created = res?.data;
      if (created) {
        setJobRoles((prev) => [...prev, created]);
        setSelectedJobRoleId(String(created.id));
        setNewRoleTitle("");
        setIsAddingRole(false);

        // Update title
        const companyObj = companies.find((c) => String(c.id) === selectedCompanyId);
        if (companyObj) {
          setDriveTitle(`${companyObj.name} — ${created.title}`);
        }
      }
    } catch (err) {
      setFormError(err.message || "Failed to create job role.");
    }
  };

  // Department checkbox toggle
  const toggleDepartment = (deptId) => {
    setSelectedDeptIds((prev) =>
      prev.includes(deptId)
        ? prev.filter((id) => id !== deptId)
        : [...prev, deptId]
    );
  };

  // Form Submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (!selectedCompanyId) {
      setFormError("Please select or add a recruiting company.");
      return;
    }
    if (!selectedJobRoleId) {
      setFormError("Please select or add a job role designation.");
      return;
    }
    if (!driveTitle.trim()) {
      setFormError("Drive title is required.");
      return;
    }
    const parsedCTC = parseFloat(packageLPA);
    if (isNaN(parsedCTC) || parsedCTC <= 0) {
      setFormError("Please enter a valid Annual CTC (in ₹ LPA).");
      return;
    }
    if (selectedDeptIds.length === 0) {
      setFormError("Please select at least one eligible academic department.");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        companyId: Number(selectedCompanyId),
        jobRoleId: Number(selectedJobRoleId),
        title: driveTitle.trim(),
        packageLPA: parsedCTC,
        driveDate: driveDate ? new Date(driveDate).toISOString() : null,
        venue: venue.trim() || null,
        hiringProcess: hiringProcess.trim() || null,
        status: "UPCOMING",
        eligibility: {
          minimumCGPA: minCGPA ? parseFloat(minCGPA) : 0,
          maximumBacklogs: maxBacklogs ? parseInt(maxBacklogs, 10) : 0,
          minimumTenth: minTenth ? parseFloat(minTenth) : 0,
          minimumTwelfth: minTwelfth ? parseFloat(minTwelfth) : null,
          minimumDiplomaPercentage: minDiploma ? parseFloat(minDiploma) : null,
          allowPreviousPlacement: false, // Strict DKTE Clause 4.2 policy
          departmentIds: selectedDeptIds,
          graduationYears: [Number(graduationYear)],
        },
      };

      const result = await createDriveApi(payload);

      if (onDriveCreated) {
        onDriveCreated(result.data);
      }
      onClose();
    } catch (err) {
      setFormError(err.message || "Failed to create placement drive.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="create-drive-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="p-0 rounded border border-[#CBD5E1] shadow-2xl w-[900px] max-w-[95vw] bg-white text-[#111827] m-auto backdrop:bg-[#111827]/60 backdrop:backdrop-blur-xs"
    >
      {/* Modal Header */}
      <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center justify-between bg-white rounded-t select-none">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-[#111827] text-[#FECC00] font-bold flex items-center justify-center text-sm shadow-xs">
            <Plus className="w-4 h-4 font-bold" />
          </div>
          <div>
            <h2 id="create-drive-title" className="font-bold text-sm text-[#111827]">
              Create Campus Recruitment Drive
            </h2>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Enter core job requisition and academic eligibility cutoffs (&lt;60s)
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-[#111827] rounded hover:bg-slate-100 transition-colors"
          title="Close dialog"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Error Alert */}
      {formError && (
        <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded text-xs text-red-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{formError}</span>
        </div>
      )}

      {/* Form Body */}
      <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto text-xs bg-slate-50/40">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Column 1: Job Requisition & Compensation */}
          <div className="bg-white border border-[#E5E7EB] rounded p-4.5 space-y-3.5 shadow-xs">
            <div className="flex items-center gap-2 border-b border-[#E5E7EB] pb-2 font-bold text-[#111827] uppercase tracking-wider text-[11px]">
              <Building2 className="w-3.5 h-3.5 text-gray-600" />
              <span>1. Job Requisition &amp; Compensation</span>
            </div>

            {/* Recruiting Company */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-gray-700 font-semibold">
                  Company / Organization *
                </label>
                <button
                  type="button"
                  onClick={() => setIsAddingCompany(!isAddingCompany)}
                  className="text-[11px] text-blue-600 hover:text-blue-800 font-medium"
                >
                  {isAddingCompany ? "Select Existing" : "+ New Company"}
                </button>
              </div>

              {isAddingCompany ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. NVIDIA Graphics India"
                    value={newCompanyName}
                    onChange={(e) => setNewCompanyName(e.target.value)}
                    className="flex-1 text-xs px-3 py-1.5 border border-[#E5E7EB] rounded focus:border-[#111827] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleQuickAddCompany}
                    className="px-3 py-1.5 bg-[#111827] text-white rounded text-xs font-semibold"
                  >
                    Add
                  </button>
                </div>
              ) : (
                <select
                  value={selectedCompanyId}
                  onChange={(e) => setSelectedCompanyId(e.target.value)}
                  required
                  className="w-full text-xs px-3 py-2 bg-white border border-[#E5E7EB] rounded focus:border-[#111827] focus:outline-none"
                >
                  <option value="">Select recruiting company...</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Job Role Designation */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-gray-700 font-semibold">
                  Job Role / Designation *
                </label>
                {selectedCompanyId && !isAddingCompany && (
                  <button
                    type="button"
                    onClick={() => setIsAddingRole(!isAddingRole)}
                    className="text-[11px] text-blue-600 hover:text-blue-800 font-medium"
                  >
                    {isAddingRole ? "Select Existing" : "+ New Role"}
                  </button>
                )}
              </div>

              {isAddingRole ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Core Systems Software Engineer"
                    value={newRoleTitle}
                    onChange={(e) => setNewRoleTitle(e.target.value)}
                    className="flex-1 text-xs px-3 py-1.5 border border-[#E5E7EB] rounded focus:border-[#111827] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleQuickAddRole}
                    className="px-3 py-1.5 bg-[#111827] text-white rounded text-xs font-semibold"
                  >
                    Add
                  </button>
                </div>
              ) : (
                <select
                  value={selectedJobRoleId}
                  onChange={(e) => {
                    setSelectedJobRoleId(e.target.value);
                    const role = jobRoles.find((r) => String(r.id) === e.target.value);
                    const comp = companies.find((c) => String(c.id) === selectedCompanyId);
                    if (role && comp) {
                      setDriveTitle(`${comp.name} — ${role.title}`);
                    }
                  }}
                  required
                  disabled={!selectedCompanyId || jobRoles.length === 0}
                  className="w-full text-xs px-3 py-2 bg-white border border-[#E5E7EB] rounded focus:border-[#111827] focus:outline-none disabled:bg-slate-100"
                >
                  {jobRoles.length === 0 ? (
                    <option value="">
                      {selectedCompanyId ? "No job roles found. Click '+ New Role'" : "Select company first"}
                    </option>
                  ) : (
                    jobRoles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.title}
                      </option>
                    ))
                  )}
                </select>
              )}
            </div>

            {/* Drive Display Title */}
            <div>
              <label className="block text-gray-700 font-semibold mb-1">
                Drive Title / Banner *
              </label>
              <input
                type="text"
                value={driveTitle}
                onChange={(e) => setDriveTitle(e.target.value)}
                required
                placeholder="e.g. NVIDIA Graphics India — Core Systems Software Engineer"
                className="w-full text-xs px-3 py-2 border border-[#E5E7EB] rounded focus:border-[#111827] focus:outline-none"
              />
            </div>

            {/* CTC Package */}
            <div>
              <label className="block text-gray-700 font-semibold mb-1">
                Annual CTC (₹ LPA) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-gray-500 font-mono font-bold">₹</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={packageLPA}
                  onChange={(e) => setPackageLPA(e.target.value)}
                  required
                  placeholder="18.00"
                  className="w-full text-xs font-mono font-bold pl-7 pr-14 py-2 border border-[#E5E7EB] rounded focus:border-[#111827] focus:outline-none tabular-nums"
                />
                <span className="absolute right-3 top-2 text-gray-400 font-mono text-[11px]">LPA</span>
              </div>
              <span className="text-[10px] text-gray-400 block mt-0.5">
                Standard format: ₹18.00 LPA (Strictly no Dream/Super-Dream tiers)
              </span>
            </div>

            {/* Date & Time */}
            <div>
              <label className="block text-gray-700 font-semibold mb-1">
                Drive Date &amp; Time
              </label>
              <input
                type="datetime-local"
                value={driveDate}
                onChange={(e) => setDriveDate(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-[#E5E7EB] rounded focus:border-[#111827] focus:outline-none font-mono"
              />
            </div>

            {/* Venue Descriptor */}
            <div>
              <label className="block text-gray-700 font-semibold mb-1">
                Assessment &amp; PPT Venue *
              </label>
              <input
                type="text"
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                required
                placeholder="e.g. DKTE Main Auditorium & Seminar Complex"
                className="w-full text-xs px-3 py-2 border border-[#E5E7EB] rounded focus:border-[#111827] focus:outline-none"
              />
              <span className="text-[10px] text-gray-400 block mt-0.5">
                Physical or virtual text descriptor (no hardware tracking)
              </span>
            </div>
          </div>

          {/* Column 2: Academic Eligibility Engine */}
          <div className="bg-white border border-[#E5E7EB] rounded p-4.5 space-y-3.5 shadow-xs">
            <div className="flex items-center gap-2 border-b border-[#E5E7EB] pb-2 font-bold text-[#111827] uppercase tracking-wider text-[11px]">
              <GraduationCap className="w-3.5 h-3.5 text-gray-600" />
              <span>2. Academic Eligibility Engine</span>
            </div>

            {/* Cutoff Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-gray-700 font-semibold mb-1">
                  Min. CGPA *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="10"
                  value={minCGPA}
                  onChange={(e) => setMinCGPA(e.target.value)}
                  required
                  className="w-full text-xs font-mono font-bold px-3 py-2 border border-[#E5E7EB] rounded focus:border-[#111827] focus:outline-none tabular-nums"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-1">
                  Max Active Backlogs
                </label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={maxBacklogs}
                  onChange={(e) => setMaxBacklogs(e.target.value)}
                  required
                  className="w-full text-xs font-mono font-bold px-3 py-2 border border-[#E5E7EB] rounded focus:border-[#111827] focus:outline-none tabular-nums"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-1">
                  Min. 10th (SSC) %
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={minTenth}
                  onChange={(e) => setMinTenth(e.target.value)}
                  className="w-full text-xs font-mono px-3 py-2 border border-[#E5E7EB] rounded focus:border-[#111827] focus:outline-none tabular-nums"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-1">
                  Min. 12th / Dip %
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={minTwelfth}
                  onChange={(e) => {
                    setMinTwelfth(e.target.value);
                    setMinDiploma(e.target.value);
                  }}
                  className="w-full text-xs font-mono px-3 py-2 border border-[#E5E7EB] rounded focus:border-[#111827] focus:outline-none tabular-nums"
                />
              </div>
            </div>

            {/* Grad Year */}
            <div>
              <label className="block text-gray-700 font-semibold mb-1">
                Academic Cohort (Graduation Year)
              </label>
              <select
                value={graduationYear}
                onChange={(e) => setGraduationYear(Number(e.target.value))}
                className="w-full text-xs px-3 py-2 bg-white border border-[#E5E7EB] rounded focus:border-[#111827] focus:outline-none font-mono"
              >
                <option value={2026}>Batch of 2026 (Final Year)</option>
                <option value={2027}>Batch of 2027 (Pre-Final Year)</option>
                <option value={2025}>Batch of 2025 (Alumni)</option>
              </select>
            </div>

            {/* Eligible Disciplines */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-gray-700 font-semibold">
                  Eligible Academic Disciplines *
                </label>
                <span className="text-[10px] text-gray-400">
                  {selectedDeptIds.length} of {departments.length} selected
                </span>
              </div>
              <div className="p-2.5 bg-slate-50 border border-[#E5E7EB] rounded max-h-36 overflow-y-auto space-y-1.5 custom-scrollbar">
                {departments.map((dept) => (
                  <label
                    key={dept.id}
                    className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer hover:text-[#111827] select-none"
                  >
                    <input
                      type="checkbox"
                      checked={selectedDeptIds.includes(dept.id)}
                      onChange={() => toggleDepartment(dept.id)}
                      className="rounded border-gray-300 text-[#111827] focus:ring-0"
                    />
                    <span className="font-medium">{dept.name}</span>
                    <span className="text-[10px] font-mono text-gray-400 ml-auto">
                      ({dept.code})
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* DKTE Policy Notice */}
            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-900 leading-relaxed">
              <strong>DKTE Clause 4.2 Policy Enforced:</strong> Previous placements are blocked by default. Students who have already secured an offer will be excluded from this drive's eligibility pool.
            </div>
          </div>
        </div>

        {/* Live Matching Banner */}
        <div className="bg-emerald-50 border border-emerald-300 rounded p-3 text-xs text-emerald-950 flex items-center justify-between">
          <span className="font-bold flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
            Dynamic Eligibility Engine Active
          </span>
          <span className="font-mono text-[11px] text-emerald-800">
            Matching students will be queued automatically for Nodemailer broadcast
          </span>
        </div>

        {/* Modal Actions */}
        <div className="pt-3 border-t border-[#E5E7EB] flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-[#E5E7EB] rounded text-xs font-semibold text-gray-600 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2.5 bg-[#FECC00] hover:bg-[#E5B800] text-[#111827] font-bold text-xs rounded flex items-center gap-1.5 shadow-sm transition-all duration-150 cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Creating Drive...</span>
              </>
            ) : (
              <span>Create Drive &amp; Prepare Email Broadcast →</span>
            )}
          </button>
        </div>
      </form>
    </dialog>
  );
}

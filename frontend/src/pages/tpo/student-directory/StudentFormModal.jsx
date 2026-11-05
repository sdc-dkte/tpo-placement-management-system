import React, { useState, useEffect } from "react";
import { X, UserPlus, Edit3, Loader2, AlertCircle } from "lucide-react";

export default function StudentFormModal({
  isOpen,
  onClose,
  onSubmit,
  initialData = null,
  departments = [],
}) {
  const isEditMode = Boolean(initialData);

  const [formData, setFormData] = useState({
    PRN: "",
    name: "",
    email: "",
    departmentId: departments[0]?.id || "",
    graduationYear: 2026,
    academicPathway: "HSC",
    CGPA: "",
    tenthPercentage: "",
    twelfthPercentage: "",
    diplomaPercentage: "",
    activeBacklogs: 0,
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  // Populate form with initial data when editing or reset for creation
  useEffect(() => {
    if (initialData) {
      setFormData({
        PRN: initialData.prn || initialData.PRN || "",
        name: initialData.name || "",
        email: initialData.email || "",
        departmentId:
          initialData.departmentId ||
          departments.find((d) => d.code === initialData.deptCode)?.id ||
          departments[0]?.id ||
          "",
        graduationYear: initialData.graduationYear || 2026,
        academicPathway: initialData.academicPathway || "HSC",
        CGPA: initialData.cgpa !== null && initialData.cgpa !== undefined ? initialData.cgpa : "",
        tenthPercentage:
          initialData.tenthPercentage !== null && initialData.tenthPercentage !== undefined
            ? initialData.tenthPercentage
            : "",
        twelfthPercentage:
          initialData.twelfthPercentage !== null && initialData.twelfthPercentage !== undefined
            ? initialData.twelfthPercentage
            : "",
        diplomaPercentage:
          initialData.diplomaPercentage !== null && initialData.diplomaPercentage !== undefined
            ? initialData.diplomaPercentage
            : "",
        activeBacklogs: initialData.backlogs !== undefined ? initialData.backlogs : 0,
      });
    } else {
      setFormData({
        PRN: "",
        name: "",
        email: "",
        departmentId: departments[0]?.id || "",
        graduationYear: 2026,
        academicPathway: "HSC",
        CGPA: "",
        tenthPercentage: "",
        twelfthPercentage: "",
        diplomaPercentage: "",
        activeBacklogs: 0,
      });
    }
    setErrors({});
    setSubmitError(null);
  }, [initialData, departments, isOpen]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.PRN.trim()) {
      newErrors.PRN = "PRN is required.";
    }

    if (!formData.name.trim()) {
      newErrors.name = "Candidate name is required.";
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim() || !emailRegex.test(formData.email)) {
      newErrors.email = "Valid institutional email is required.";
    }

    if (!formData.departmentId) {
      newErrors.departmentId = "Department selection is required.";
    }

    const cgpa = Number(formData.CGPA);
    if (formData.CGPA !== "" && (isNaN(cgpa) || cgpa < 0 || cgpa > 10)) {
      newErrors.CGPA = "CGPA must be between 0.00 and 10.00.";
    }

    const tenth = Number(formData.tenthPercentage);
    if (formData.tenthPercentage === "" || isNaN(tenth) || tenth < 0 || tenth > 100) {
      newErrors.tenthPercentage = "10th percentage is required (0–100%).";
    }

    if (formData.academicPathway === "HSC") {
      const twelfth = Number(formData.twelfthPercentage);
      if (formData.twelfthPercentage === "" || isNaN(twelfth) || twelfth < 0 || twelfth > 100) {
        newErrors.twelfthPercentage = "12th percentage is required for HSC pathway (0–100%).";
      }
    } else if (formData.academicPathway === "DIPLOMA") {
      const diploma = Number(formData.diplomaPercentage);
      if (formData.diplomaPercentage === "" || isNaN(diploma) || diploma < 0 || diploma > 100) {
        newErrors.diplomaPercentage = "Diploma percentage is required for DIPLOMA pathway (0–100%).";
      }
    }

    const backlogs = Number(formData.activeBacklogs);
    if (isNaN(backlogs) || backlogs < 0 || !Number.isInteger(backlogs)) {
      newErrors.activeBacklogs = "Backlogs must be a non-negative integer.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    setSubmitError(null);

    const payload = {
      PRN: formData.PRN.trim().toUpperCase(),
      password: formData.PRN.trim().toUpperCase(),
      name: formData.name.trim(),
      email: formData.email.trim().toLowerCase(),
      departmentId: Number(formData.departmentId),
      graduationYear: Number(formData.graduationYear),
      academicPathway: formData.academicPathway,
      CGPA: formData.CGPA !== "" ? Number(formData.CGPA) : null,
      tenthPercentage: Number(formData.tenthPercentage),
      twelfthPercentage:
        formData.academicPathway === "HSC" ? Number(formData.twelfthPercentage) : null,
      diplomaPercentage:
        formData.academicPathway === "DIPLOMA" ? Number(formData.diplomaPercentage) : null,
      activeBacklogs: Number(formData.activeBacklogs) || 0,
    };

    try {
      await onSubmit(payload);
      onClose();
    } catch (err) {
      console.error("Student form submission error:", err);
      setSubmitError(err.message || "Failed to save student record.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-2xl bg-white border border-[#E5E7EB] rounded-lg shadow-2xl flex flex-col max-h-[90vh] overflow-hidden z-10 animate-fadeIn">
        {/* Modal Header */}
        <div className="h-16 px-6 border-b border-[#E5E7EB] flex items-center justify-between bg-white flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center text-gray-800">
              {isEditMode ? <Edit3 className="w-4 h-4 text-blue-600" /> : <UserPlus className="w-4 h-4 text-gray-800" />}
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900 tracking-tight">
                {isEditMode ? `Edit Candidate: ${formData.name || formData.PRN}` : "Add Candidate to Registry"}
              </h2>
              <p className="text-[11px] text-gray-500">
                {isEditMode
                  ? "Update academic metrics, department, or contact information."
                  : "Manually onboard a student record into the placement directory without CSV."}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {submitError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Section 1: Candidate Identity */}
          <div>
            <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider mb-3">
              1. Candidate Identity & Contact
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  PRN (Permanent Reg. No.) *
                </label>
                <input
                  type="text"
                  name="PRN"
                  disabled={isEditMode}
                  value={formData.PRN}
                  onChange={handleChange}
                  placeholder="e.g. 22CS050"
                  className={`w-full text-xs px-3 py-2 border rounded font-mono ${
                    isEditMode ? "bg-gray-100 text-gray-500 cursor-not-allowed border-gray-300" : "border-gray-300 focus:border-gray-900"
                  }`}
                />
                {errors.PRN && <p className="text-[11px] text-rose-600 mt-0.5">{errors.PRN}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g. Rohan Patil"
                  className="w-full text-xs px-3 py-2 border border-gray-300 rounded focus:border-gray-900"
                />
                {errors.name && <p className="text-[11px] text-rose-600 mt-0.5">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="rohan.p@dkte.ac.in"
                  className="w-full text-xs px-3 py-2 border border-gray-300 rounded focus:border-gray-900"
                />
                {errors.email && <p className="text-[11px] text-rose-600 mt-0.5">{errors.email}</p>}
              </div>
            </div>
          </div>

          {/* Section 2: Department & Academic Pathway */}
          <div>
            <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider mb-3">
              2. Department & Academic Pathway
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Department / Branch *
                </label>
                <select
                  name="departmentId"
                  value={formData.departmentId}
                  onChange={handleChange}
                  className="w-full text-xs px-3 py-2 border border-gray-300 rounded bg-white focus:border-gray-900"
                >
                  <option value="">Select Department</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name} ({dept.code})
                    </option>
                  ))}
                </select>
                {errors.departmentId && (
                  <p className="text-[11px] text-rose-600 mt-0.5">{errors.departmentId}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Graduation Year *
                </label>
                <select
                  name="graduationYear"
                  value={formData.graduationYear}
                  onChange={handleChange}
                  className="w-full text-xs px-3 py-2 border border-gray-300 rounded bg-white focus:border-gray-900"
                >
                  <option value={2025}>Batch 2025</option>
                  <option value={2026}>Batch 2026</option>
                  <option value={2027}>Batch 2027</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Academic Pathway *
                </label>
                <div className="grid grid-cols-2 gap-2 mt-0.5">
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, academicPathway: "HSC" }))}
                    className={`py-1.5 text-xs font-semibold rounded border transition ${
                      formData.academicPathway === "HSC"
                        ? "bg-[#FECC00] text-gray-950 border-[#E5B800]"
                        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    12th (HSC)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, academicPathway: "DIPLOMA" }))}
                    className={`py-1.5 text-xs font-semibold rounded border transition ${
                      formData.academicPathway === "DIPLOMA"
                        ? "bg-[#FECC00] text-gray-950 border-[#E5B800]"
                        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    Diploma
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Performance Metrics & Scores */}
          <div>
            <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider mb-3">
              3. Performance Metrics & Academic Scores
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  CGPA (0.00 – 10.00)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="10"
                  name="CGPA"
                  value={formData.CGPA}
                  onChange={handleChange}
                  placeholder="8.50"
                  className="w-full text-xs px-3 py-2 border border-gray-300 rounded tabular-nums focus:border-gray-900"
                />
                {errors.CGPA && <p className="text-[11px] text-rose-600 mt-0.5">{errors.CGPA}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Active Backlogs
                </label>
                <input
                  type="number"
                  min="0"
                  name="activeBacklogs"
                  value={formData.activeBacklogs}
                  onChange={handleChange}
                  placeholder="0"
                  className="w-full text-xs px-3 py-2 border border-gray-300 rounded tabular-nums focus:border-gray-900"
                />
                {errors.activeBacklogs && (
                  <p className="text-[11px] text-rose-600 mt-0.5">{errors.activeBacklogs}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  10th Percentage (%) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  name="tenthPercentage"
                  value={formData.tenthPercentage}
                  onChange={handleChange}
                  placeholder="85.50"
                  className="w-full text-xs px-3 py-2 border border-gray-300 rounded tabular-nums focus:border-gray-900"
                />
                {errors.tenthPercentage && (
                  <p className="text-[11px] text-rose-600 mt-0.5">{errors.tenthPercentage}</p>
                )}
              </div>

              {formData.academicPathway === "HSC" ? (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    12th Percentage (%) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    name="twelfthPercentage"
                    value={formData.twelfthPercentage}
                    onChange={handleChange}
                    placeholder="82.40"
                    className="w-full text-xs px-3 py-2 border border-gray-300 rounded tabular-nums focus:border-gray-900"
                  />
                  {errors.twelfthPercentage && (
                    <p className="text-[11px] text-rose-600 mt-0.5">{errors.twelfthPercentage}</p>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Diploma Percentage (%) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    name="diplomaPercentage"
                    value={formData.diplomaPercentage}
                    onChange={handleChange}
                    placeholder="84.20"
                    className="w-full text-xs px-3 py-2 border border-gray-300 rounded tabular-nums focus:border-gray-900"
                  />
                  {errors.diplomaPercentage && (
                    <p className="text-[11px] text-rose-600 mt-0.5">{errors.diplomaPercentage}</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-[#E5E7EB] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-bold text-[#111827] bg-dkte-gold hover:bg-dkte-gold-hover rounded-md shadow-xs flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer active:scale-[0.98]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving Record...</span>
                </>
              ) : (
                <span>{isEditMode ? "Save Changes" : "Create Candidate Record"}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

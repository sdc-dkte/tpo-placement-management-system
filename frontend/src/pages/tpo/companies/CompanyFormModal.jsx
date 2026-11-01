import React, { useState, useEffect } from "react";
import { X, Building2, Globe, FileText, Loader2, CheckCircle2 } from "lucide-react";

/**
 * Modal to Onboard or Edit a Recruiting Company Partner
 */
export default function CompanyFormModal({
  isOpen,
  onClose,
  companyToEdit = null,
  onSubmit,
}) {
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (companyToEdit) {
      setName(companyToEdit.name || "");
      setWebsite(companyToEdit.website || "");
      setDescription(companyToEdit.description || "");
      setIsActive(companyToEdit.isActive ?? true);
    } else {
      setName("");
      setWebsite("");
      setDescription("");
      setIsActive(true);
    }
    setError(null);
  }, [companyToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Company name is required.");
      return;
    }

    if (website.trim()) {
      try {
        const parsed = new URL(website.trim());
        if (!["http:", "https:"].includes(parsed.protocol)) {
          setError("Website must start with http:// or https://");
          return;
        }
      } catch {
        setError("Please enter a valid website URL (e.g., https://example.com).");
        return;
      }
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const payload = {
        name: name.trim(),
        website: website.trim() || null,
        description: description.trim() || null,
        isActive,
      };

      await onSubmit(payload, companyToEdit?.id);
      onClose();
    } catch (err) {
      setError(err.message || "Failed to save company details.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-2xs">
      <div
        className="bg-white border border-[#111827] rounded w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-[#111827] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-gray-800 border border-gray-700 flex items-center justify-center text-[#FECC00]">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight text-white">
                {companyToEdit ? "Edit Recruiter Profile" : "Onboard Recruiting Partner"}
              </h2>
              <p className="text-[11px] text-gray-400">
                DKTE Central Training &amp; Placement Cell
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-start gap-2">
              <span className="font-semibold shrink-0">Error:</span>
              <span>{error}</span>
            </div>
          )}

          {/* Company Name */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[#111827]">
              Company Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Building2 className="absolute left-3 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Tata Consultancy Services, Goldman Sachs"
                className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-[#E5E7EB] rounded text-[#111827] placeholder-gray-400 focus:outline-none focus:border-[#111827] transition"
              />
            </div>
          </div>

          {/* Website URL */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[#111827]">
              Corporate Website
            </label>
            <div className="relative">
              <Globe className="absolute left-3 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://company.com"
                className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-[#E5E7EB] rounded text-[#111827] placeholder-gray-400 focus:outline-none focus:border-[#111827] transition font-mono"
              />
            </div>
            <p className="text-[11px] text-gray-500">
              Must be an absolute URL starting with http:// or https://
            </p>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[#111827]">
              Company Overview &amp; Domain
            </label>
            <div className="relative">
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of recruiting domain, products, and industry vertical..."
                className="w-full p-2.5 text-xs bg-white border border-[#E5E7EB] rounded text-[#111827] placeholder-gray-400 focus:outline-none focus:border-[#111827] transition"
              />
            </div>
          </div>

          {/* Active Status Checkbox */}
          <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
            <div>
              <span className="block text-xs font-semibold text-[#111827]">
                Active Partnership Status
              </span>
              <span className="block text-[11px] text-gray-500">
                Active partners are available when scheduling new campus recruitment drives.
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#111827]"></div>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-gray-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3.5 py-2 text-xs font-medium text-gray-700 bg-white border border-[#E5E7EB] rounded hover:bg-gray-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#111827] bg-[#FECC00] hover:bg-[#e5b800] border border-[#FECC00] rounded transition cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{companyToEdit ? "Update Company" : "Confirm Onboard"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

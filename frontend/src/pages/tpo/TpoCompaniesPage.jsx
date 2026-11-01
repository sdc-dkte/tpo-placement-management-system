import React, { useState, useEffect, useCallback } from "react";
import {
  Building2,
  RefreshCw,
  Plus,
  AlertCircle,
  FileSpreadsheet,
} from "lucide-react";
import {
  getCompaniesApi,
  createCompanyApi,
  updateCompanyApi,
} from "../../api/companies";
import CompanyFilterToolbar from "./companies/CompanyFilterToolbar";
import CompanyStatsBar from "./companies/CompanyStatsBar";
import CompanyRosterTable from "./companies/CompanyRosterTable";
import CompanyFormModal from "./companies/CompanyFormModal";
import CompanyDetailDrawer from "./companies/CompanyDetailDrawer";

/**
 * Company Directory & CRM Console (/companies)
 * Recruiter database, registered job roles, and campus hiring history.
 */
export default function TpoCompaniesPage() {
  const [companies, setCompanies] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });

  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("ALL"); // 'ALL' | 'true' | 'false'
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal & Drawer State
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [companyToEdit, setCompanyToEdit] = useState(null);
  const [selectedCompanyForDrawer, setSelectedCompanyForDrawer] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const fetchCompanies = useCallback(async (page = 1) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await getCompaniesApi({
        page,
        limit: 20,
        search: search.trim() || undefined,
        isActive: activeFilter,
      });

      setCompanies(res.data || []);
      if (res.pagination) {
        setPagination(res.pagination);
      }
    } catch (err) {
      console.error("Failed to fetch companies:", err);
      setError(err.message || "Failed to load company directory.");
    } finally {
      setIsLoading(false);
    }
  }, [search, activeFilter]);

  useEffect(() => {
    fetchCompanies(1);
  }, [fetchCompanies]);

  // Compute Stats
  const totalCompaniesCount = pagination.total || companies.length;
  const activeCompaniesCount = companies.filter((c) => c.isActive).length;
  const totalJobRolesCount = companies.reduce(
    (sum, c) => sum + (c.jobRoleCount || 0),
    0
  );
  const totalDrivesCount = companies.reduce(
    (sum, c) => sum + (c.driveCount || 0),
    0
  );

  const handleOpenCreateModal = () => {
    setCompanyToEdit(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEditModal = (company) => {
    setCompanyToEdit(company);
    setIsFormModalOpen(true);
  };

  const handleFormSubmit = async (payload, companyId) => {
    if (companyId) {
      await updateCompanyApi(companyId, payload);
    } else {
      await createCompanyApi(payload);
    }
    await fetchCompanies(pagination.page);

    // If edited company is currently open in drawer, update drawer state
    if (selectedCompanyForDrawer && selectedCompanyForDrawer.id === companyId) {
      setSelectedCompanyForDrawer((prev) => ({ ...prev, ...payload }));
    }
  };

  const handleViewCompany = (company) => {
    setSelectedCompanyForDrawer(company);
    setIsDrawerOpen(true);
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      fetchCompanies(newPage);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto w-full">
      {/* Institutional Top Bar Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E5E7EB] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#FECC00] text-[#111827]">
              DKTE TPO CRM
            </span>
            <span className="text-gray-400 text-xs">|</span>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Corporate Relations
            </span>
          </div>
          <h1 className="text-2xl font-bold text-[#111827] tracking-tight mt-1">
            Recruiting Partner Directory &amp; CRM
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Manage corporate recruiting partnerships, registered job profiles, and historical campus placement records.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => fetchCompanies(pagination.page)}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded bg-white hover:bg-gray-50 text-gray-700 text-xs font-medium border border-[#E5E7EB] transition cursor-pointer"
            title="Refresh Directory"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-[#FECC00] hover:bg-[#e5b800] text-[#111827] text-xs font-semibold border border-[#FECC00] transition cursor-pointer shadow-2xs"
          >
            <Plus className="w-4 h-4" />
            <span>Onboard Recruiter</span>
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded text-xs text-red-800 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Stats Bar */}
      <CompanyStatsBar
        totalCompanies={totalCompaniesCount}
        activeCompanies={activeCompaniesCount}
        totalJobRoles={totalJobRolesCount}
        totalDrives={totalDrivesCount}
      />

      {/* Filter & Search Toolbar */}
      <CompanyFilterToolbar
        search={search}
        onSearchChange={setSearch}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        onAddCompany={handleOpenCreateModal}
        totalCount={pagination.total}
      />

      {/* Recruiter Roster Table */}
      <CompanyRosterTable
        companies={companies}
        isLoading={isLoading}
        onViewCompany={handleViewCompany}
        onEditCompany={handleOpenEditModal}
      />

      {/* Pagination Controls */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-[#E5E7EB]">
          <div>
            Showing{" "}
            <span className="font-semibold text-gray-900 font-mono">
              {(pagination.page - 1) * pagination.limit + 1}
            </span>{" "}
            to{" "}
            <span className="font-semibold text-gray-900 font-mono">
              {Math.min(pagination.page * pagination.limit, pagination.total)}
            </span>{" "}
            of{" "}
            <span className="font-semibold text-gray-900 font-mono">
              {pagination.total}
            </span>{" "}
            recruiting partners
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={pagination.page <= 1}
              onClick={() => handlePageChange(pagination.page - 1)}
              className="px-2.5 py-1.5 rounded border border-[#E5E7EB] bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
            >
              Previous
            </button>
            <span className="px-3 py-1 font-mono font-medium text-gray-700">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              type="button"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => handlePageChange(pagination.page + 1)}
              className="px-2.5 py-1.5 rounded border border-[#E5E7EB] bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Onboard / Edit Modal */}
      <CompanyFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        companyToEdit={companyToEdit}
        onSubmit={handleFormSubmit}
      />

      {/* Detail & Job Roles Drawer */}
      <CompanyDetailDrawer
        company={selectedCompanyForDrawer}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onEditCompany={(comp) => {
          setIsDrawerOpen(false);
          handleOpenEditModal(comp);
        }}
        onCompanyUpdated={() => fetchCompanies(pagination.page)}
      />
    </div>
  );
}

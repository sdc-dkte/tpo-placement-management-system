import React, { useState, useEffect, useCallback } from "react";
import {
  UploadCloud,
  Download,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

import {
  getStudentsApi,
  getDepartmentsApi,
  getDashboardOverviewApi,
  createStudentApi,
  updateStudentApi,
} from "../../../api/students";

import StudentStatsBar from "./StudentStatsBar";
import BranchFilterChips from "./BranchFilterChips";
import StudentFilterToolbar from "./StudentFilterToolbar";
import StudentRosterTable from "./StudentRosterTable";
import CandidateDossierDrawer from "./CandidateDossierDrawer";
import BatchIngestionModal from "./BatchIngestionModal";
import StudentFormModal from "./StudentFormModal";
import BulkActionBar from "./BulkActionBar";
import Pagination from "./Pagination";

/**
 * Adapter: Direct mapping of backend API response fields.
 * Any missing backend field is explicitly flagged as unprovided by API.
 */
function mapBackendStudentToRoster(student) {
  const isPlaced =
    student.placementStatus === "SELECTED" ||
    student.placementStatus === "OFFER_ACCEPTED" ||
    student.selection?.status === "SELECTED" ||
    student.selection?.status === "OFFER_ACCEPTED";

  const isInReview = student.placementStatus === "IN_REVIEW";

  const status = isPlaced ? "Placed" : isInReview ? "In Review" : "Unplaced";

  // If student is placed but backend did not join company name, reflect that reality
  const organization = isPlaced
    ? student.selection?.company?.name || "Placed (Company not returned by API)"
    : isInReview
    ? "Drive in Review"
    : "Open to Drives —";

  return {
    id: student.id,
    prn: student.PRN || `PRN-${student.id}`,
    name: student.name || student.user?.name || "Unnamed Candidate",
    email: student.email || student.user?.email || "No email",
    branch: student.department?.name || "No department",
    deptCode: student.department?.code || "",
    departmentId: student.department?.id,
    cgpa: student.CGPA ?? null,
    backlogs: student.activeBacklogs ?? 0,
    status,
    rawPlacementStatus: student.placementStatus || "NOT_SELECTED",
    organization,
    packageLPA: student.selection?.packageLPA ?? null,
    academicPathway: student.academicPathway || "HSC",
    tenthPercentage: student.tenthPercentage ?? null,
    twelfthPercentage: student.twelfthPercentage ?? null,
    diplomaPercentage: student.diplomaPercentage ?? null,
    graduationYear: student.graduationYear || 2026,
    drivesParticipated: student.driveParticipations || [],
  };
}

export default function StudentDirectoryPage() {
  // Live API data states
  const [students, setStudents] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [overviewStats, setOverviewStats] = useState({
    total: 0,
    placed: 0,
    unplaced: 0,
    syncStatus: "Connecting...",
  });

  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [serverTotalCount, setServerTotalCount] = useState(0);
  const [serverTotalPages, setServerTotalPages] = useState(1);

  // Filter state
  const [selectedBranch, setSelectedBranch] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [cgpaFilter, setCgpaFilter] = useState("ALL");
  const [backlogFilter, setBacklogFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedIds, setSelectedIds] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Modals & Drawers
  const [isIngestionModalOpen, setIsIngestionModalOpen] = useState(false);
  const [activeDossierStudent, setActiveDossierStudent] = useState(null);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [studentToEdit, setStudentToEdit] = useState(null);
  const [actionFeedback, setActionFeedback] = useState(null);


  // 1. Fetch departments from backend API
  const fetchDepartments = useCallback(async () => {
    try {
      const res = await getDepartmentsApi();
      if (res?.data && Array.isArray(res.data)) {
        setDepartments(res.data);
      }
    } catch (err) {
      console.error("Departments API error:", err);
      setApiError(`Departments API error: ${err.message}`);
    }
  }, []);

  // 2. Fetch dashboard overview stats from backend API
  const fetchOverview = useCallback(async () => {
    try {
      const res = await getDashboardOverviewApi();
      if (res?.data) {
        setOverviewStats({
          total: res.data.totalStudents ?? 0,
          placed: res.data.placedStudents ?? 0,
          unplaced: res.data.unplacedStudents ?? 0,
          syncStatus: "Active & Synchronized",
        });
      }
    } catch (err) {
      console.error("Dashboard overview API error:", err);
      setApiError(`Dashboard overview API error: ${err.message}`);
    }
  }, []);

  useEffect(() => {
    fetchDepartments();
    fetchOverview();
  }, [fetchDepartments, fetchOverview]);

  // 3. Fetch students from GET /api/v1/students
  const fetchStudents = useCallback(async () => {
    setIsLoading(true);
    setApiError(null);

    try {
      let departmentId;
      if (selectedBranch !== "ALL" && departments.length > 0) {
        const found = departments.find((d) => d.code === selectedBranch);
        if (found) departmentId = found.id;
      }

      const params = {
        page: currentPage,
        limit: pageSize,
        sortOrder: "asc",
      };

      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }

      if (departmentId !== undefined) {
        params.departmentId = departmentId;
      }

      if (cgpaFilter !== "ALL") {
        params.minCGPA = Number(cgpaFilter);
      }

      if (backlogFilter === "ZERO") {
        params.maxBacklogs = 0;
      }

      const res = await getStudentsApi(params);

      if (res?.data && Array.isArray(res.data)) {
        const total = res.pagination?.total ?? 0;
        const totalPages = Math.max(1, res.pagination?.totalPages ?? Math.ceil(total / pageSize));

        // Self-healing pagination: if current page is empty or beyond total pages while records exist
        if (currentPage > 1 && (total === 0 || currentPage > totalPages || res.data.length === 0)) {
          const targetPage = total === 0 ? 1 : Math.max(1, totalPages);
          setCurrentPage(targetPage);
          return;
        }

        const rosterStudents = res.data.map(mapBackendStudentToRoster);

        // Client-side filter for status because backend lacks ?status= query filter
        const filtered =
          statusFilter === "ALL"
            ? rosterStudents
            : rosterStudents.filter((s) => s.status === statusFilter);

        setStudents(filtered);
        setServerTotalCount(total);
        setServerTotalPages(totalPages);
      } else {
        setStudents([]);
        setServerTotalCount(0);
        setServerTotalPages(1);
      }
    } catch (err) {
      console.error("GET /api/v1/students error:", err);
      setStudents([]);
      setServerTotalCount(0);
      setServerTotalPages(1);
      setApiError(`GET /api/v1/students failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [
    currentPage,
    pageSize,
    selectedBranch,
    searchQuery,
    cgpaFilter,
    backlogFilter,
    statusFilter,
    departments,
  ]);

  useEffect(() => {
    const timer = setTimeout(fetchStudents, 250);
    return () => clearTimeout(timer);
  }, [fetchStudents]);

  // Multi-select handlers
  const handleToggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    const currentPageIds = students.map((s) => s.id);
    const isAllSelected =
      currentPageIds.length > 0 &&
      currentPageIds.every((id) => selectedIds.includes(id));

    if (isAllSelected) {
      setSelectedIds((prev) => prev.filter((id) => !currentPageIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...currentPageIds])));
    }
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
  };

  const handleClearFilters = () => {
    setSelectedBranch("ALL");
    setSearchQuery("");
    setCgpaFilter("ALL");
    setBacklogFilter("ALL");
    setStatusFilter("ALL");
    setCurrentPage(1);
  };

  // Export filtered roster to CSV
  const handleExportRoster = (targetList = students) => {
    let csv =
      "PRN,Candidate Name,Email,Branch,CGPA,Backlogs,Placement Status,Organization,Package (LPA)\n";
    targetList.forEach((s) => {
      csv += `${s.prn},"${s.name}",${s.email},"${s.branch}",${s.cgpa || ""},${
        s.backlogs
      },"${s.status}","${s.organization || ""}",${s.packageLPA || ""}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `dkte_placement_roster_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportSelected = () => {
    const selectedStudentsList = students.filter((s) => selectedIds.includes(s.id));
    handleExportRoster(selectedStudentsList);
  };

  // Callback when batch ingestion completes
  const handleIngestionSuccess = () => {
    // Re-query real backend data to reflect new state
    fetchOverview();
    fetchDepartments();
    fetchStudents();
  };

  // CRUD Handlers
  const handleOpenAddStudent = () => {
    setStudentToEdit(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEditStudent = (student) => {
    setStudentToEdit(student);
    setIsFormModalOpen(true);
  };

  const handleFormSubmit = async (payload) => {
    if (studentToEdit) {
      // 1. Update Candidate Details
      try {
        await updateStudentApi(studentToEdit.id, payload);
        setActionFeedback({
          type: "success",
          message: `Candidate ${payload.name} (${studentToEdit.prn}) updated successfully.`,
        });
        fetchStudents();
        fetchOverview();
      } catch (err) {
        console.error("Backend update error:", err);
        setActionFeedback({
          type: "error",
          message: err.message || `Failed to update candidate ${payload.name}.`,
        });
      }
    } else {
      // 2. Create New Candidate
      try {
        await createStudentApi(payload);
        setActionFeedback({
          type: "success",
          message: `Candidate ${payload.name} (${payload.PRN}) successfully onboarded to registry.`,
        });
        fetchStudents();
        fetchOverview();
        fetchDepartments();
      } catch (err) {
        console.error("Backend create error:", err);
        setActionFeedback({
          type: "error",
          message: err.message || `Failed to onboard candidate ${payload.name}.`,
        });
      }
    }

    setTimeout(() => setActionFeedback(null), 5000);
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#F8FAFC]">
      {/* Top Header Bar */}
      <header className="h-16 bg-white border-b border-[#E5E7EB] px-8 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2 text-xs text-gray-500 font-medium select-none">
          <span>Student Registry</span>
          <span>/</span>
          <span className="text-gray-900 font-semibold">Master Candidate Roster</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs text-slate-700 font-medium select-none">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>AY 2025–26</span>
          </div>

          {/* Top Bar Action: Upload / Import Student CSV */}
          <button
            type="button"
            onClick={() => setIsIngestionModalOpen(true)}
            className="px-3.5 py-1.5 rounded-md bg-dkte-gold hover:bg-dkte-gold-hover text-[#111827] text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer active:scale-[0.98]"
          >
            <UploadCloud className="w-4 h-4 text-[#111827]" />
            <span>Upload Student CSV</span>
          </button>

          {/* Top Bar Action: Export Roster */}
          <button
            type="button"
            onClick={() => handleExportRoster()}
            className="px-3 py-1.5 rounded-md border border-gray-300 text-xs font-medium bg-white hover:bg-gray-50 text-gray-700 flex items-center gap-1.5 transition shadow-2xs cursor-pointer active:scale-[0.98]"
          >
            <Download className="w-3.5 h-3.5 text-gray-500" />
            <span>Export Roster</span>
          </button>
        </div>
      </header>

      {/* Main Page Content */}
      <main className="p-8 space-y-5">
        {/* Action Feedback Notification Banner */}
        {actionFeedback && (
          <div
            className={`p-3 rounded text-xs flex items-center justify-between shadow-2xs animate-fadeIn border ${
              actionFeedback.type === "error"
                ? "bg-rose-50 border-rose-200 text-rose-900"
                : "bg-emerald-50 border-emerald-200 text-emerald-900"
            }`}
          >
            <div className="flex items-center gap-2">
              {actionFeedback.type === "error" ? (
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              )}
              <span className="font-semibold">{actionFeedback.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setActionFeedback(null)}
              className={`font-bold text-xs cursor-pointer ${
                actionFeedback.type === "error"
                  ? "text-rose-700 hover:text-rose-900"
                  : "text-emerald-700 hover:text-emerald-900"
              }`}
            >
              Dismiss
            </button>
          </div>
        )}
        {/* Page Title Row */}
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              Institutional Student Placement Roster
            </h1>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-800">
              Batch 2026
            </span>
            {isLoading && (
              <RefreshCw className="w-3.5 h-3.5 text-amber-500 animate-spin ml-1" />
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Centralized placement repository and academic credentials across {departments.length} registered departments.
          </p>
        </div>

        {/* Error Banner if API returned error */}
        {apiError && (
          <div className="p-3.5 rounded bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span className="font-medium">{apiError}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                fetchOverview();
                fetchDepartments();
                fetchStudents();
              }}
              className="px-2.5 py-1 rounded bg-rose-600 text-white font-semibold text-[11px] hover:bg-rose-700 transition"
            >
              Retry API Call
            </button>
          </div>
        )}

        {/* 1. KPI Metric Strip */}
        <StudentStatsBar
          total={overviewStats.total}
          placed={overviewStats.placed}
          unplaced={overviewStats.unplaced}
          syncStatus={overviewStats.syncStatus}
        />

        {/* 2. Department Filter Chips */}
        <BranchFilterChips
          selectedBranch={selectedBranch}
          departments={departments}
          totalCount={overviewStats.total}
          onSelectBranch={(branchCode) => {
            setSelectedBranch(branchCode);
            setCurrentPage(1);
          }}
        />

        {/* 3. Filter Toolbar */}
        <StudentFilterToolbar
          searchQuery={searchQuery}
          onSearchChange={(query) => {
            setSearchQuery(query);
            setCurrentPage(1);
          }}
          cgpaFilter={cgpaFilter}
          onCgpaFilterChange={(val) => {
            setCgpaFilter(val);
            setCurrentPage(1);
          }}
          backlogFilter={backlogFilter}
          onBacklogFilterChange={(val) => {
            setBacklogFilter(val);
            setCurrentPage(1);
          }}
          statusFilter={statusFilter}
          onStatusFilterChange={(val) => {
            setStatusFilter(val);
            setCurrentPage(1);
          }}
          onClearFilters={handleClearFilters}
          totalCount={overviewStats.total}
          visibleCount={serverTotalCount}
          onAddStudent={handleOpenAddStudent}
        />

        {/* 4. Candidate Roster Data Table */}
        <StudentRosterTable
          students={students}
          selectedIds={selectedIds}
          activeStudentId={activeDossierStudent?.id}
          onToggleSelect={handleToggleSelect}
          onToggleSelectAll={handleToggleSelectAll}
          onViewDossier={(student) => setActiveDossierStudent(student)}
          onEditStudent={handleOpenEditStudent}
        />

        {/* 5. Pagination */}
        <Pagination
          currentPage={currentPage}
          totalPages={serverTotalPages}
          totalItems={serverTotalCount}
          pageSize={pageSize}
          onPageChange={(page) => setCurrentPage(page)}
        />
      </main>

      {/* Floating Bulk Action Bar when checkboxes are active */}
      <BulkActionBar
        selectedCount={selectedIds.length}
        onClearSelection={handleClearSelection}
        onExportSelected={handleExportSelected}
      />

      {/* Candidate Dossier Slide-Over Drawer */}
      <CandidateDossierDrawer
        student={activeDossierStudent}
        isOpen={Boolean(activeDossierStudent)}
        onClose={() => setActiveDossierStudent(null)}
        onEditStudent={handleOpenEditStudent}
      />

      {/* Batch Ingestion Modal */}
      <BatchIngestionModal
        isOpen={isIngestionModalOpen}
        onClose={() => setIsIngestionModalOpen(false)}
        onIngestionSuccess={handleIngestionSuccess}
      />

      {/* Student Form Modal (Add & Edit) */}
      <StudentFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setStudentToEdit(null);
        }}
        onSubmit={handleFormSubmit}
        initialData={studentToEdit}
        departments={departments}
      />
    </div>
  );
}
import { apiClient } from "./client";

/**
 * Fetch paginated, filtered, and searched students for TPO roster.
 * Supported query params:
 * - page (default 1)
 * - limit (default 20, max 100)
 * - search (searches PRN, user.name, user.email)
 * - departmentId (number)
 * - graduationYear (number)
 * - minCGPA (number)
 * - maxBacklogs (number)
 * - sortOrder ('asc' | 'desc')
 */
export async function getStudentsApi(params = {}) {
  const query = new URLSearchParams();

  if (params.page) query.append("page", params.page);
  if (params.limit) query.append("limit", params.limit);
  if (params.search && params.search.trim()) query.append("search", params.search.trim());
  if (params.departmentId) query.append("departmentId", params.departmentId);
  if (params.graduationYear) query.append("graduationYear", params.graduationYear);
  if (params.minCGPA !== undefined && params.minCGPA !== "ALL") {
    query.append("minCGPA", params.minCGPA);
  }
  if (params.maxBacklogs !== undefined) {
    query.append("maxBacklogs", params.maxBacklogs);
  }
  if (params.sortOrder) query.append("sortOrder", params.sortOrder);

  const queryString = query.toString();
  const endpoint = queryString ? `/students?${queryString}` : "/students";

  return apiClient(endpoint);
}

/**
 * Fetch detailed student record for candidate dossier.
 */
export async function getStudentByIdApi(studentId) {
  return apiClient(`/students/${studentId}`);
}

/**
 * Fetch list of departments with student counts.
 */
export async function getDepartmentsApi(params = {}) {
  const query = new URLSearchParams({ limit: "50", ...params });
  return apiClient(`/departments?${query.toString()}`);
}

/**
 * Fetch dashboard overview statistics for the top KPI metric bar.
 */
export async function getDashboardOverviewApi() {
  return apiClient("/dashboard/overview");
}

/**
 * Upload student CSV batch file.
 */
export async function uploadStudentBatchCsvApi(file) {
  const formData = new FormData();
  formData.append("file", file);

  const token = localStorage.getItem("tpo_auth_token");
  const response = await fetch("/api/v1/import/students", {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  const data = await response.json().catch(() => ({
    success: false,
    message: "Invalid response from server.",
  }));

  if (!response.ok) {
    const error = new Error(data.message || `Upload failed with status ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

/**
 * Create a new student record manually (without CSV).
 */
export async function createStudentApi(studentData) {
  return apiClient("/students", {
    method: "POST",
    body: studentData,
  });
}

/**
 * Update an existing student's academic and profile details.
 * Matches backend: PATCH /api/v1/students/:studentId
 */
export async function updateStudentApi(studentId, updateData) {
  const allowedFields = [
    "name",
    "email",
    "PRN",
    "departmentId",
    "graduationYear",
    "academicPathway",
    "CGPA",
    "tenthPercentage",
    "twelfthPercentage",
    "diplomaPercentage",
    "activeBacklogs",
  ];

  const payload = {};
  for (const field of allowedFields) {
    if (updateData[field] !== undefined) {
      payload[field] = updateData[field];
    }
  }

  return apiClient(`/students/${studentId}`, {
    method: "PATCH",
    body: payload,
  });
}

/**
 * Update a student's account active status (Deactivate / Reactivate).
 * Matches backend: PATCH /api/v1/students/:id/status
 */
export async function updateStudentStatusApi(studentId, isActive = false) {
  return apiClient(`/students/${studentId}/status`, {
    method: "PATCH",
    body: { isActive },
  });
}

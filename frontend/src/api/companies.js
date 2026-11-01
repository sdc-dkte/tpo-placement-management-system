import { apiClient } from "./client";

/**
 * Fetch paginated, searchable list of recruiting partner companies.
 * Supported params:
 * - page (default 1)
 * - limit (default 20, max 100)
 * - search (string)
 * - isActive (boolean string: 'true' | 'false')
 */
export async function getCompaniesApi(params = {}) {
  const query = new URLSearchParams();

  if (params.page) query.append("page", params.page);
  if (params.limit) query.append("limit", params.limit);
  if (params.search && params.search.trim()) query.append("search", params.search.trim());
  if (params.isActive !== undefined && params.isActive !== "ALL") {
    query.append("isActive", params.isActive);
  }

  const queryString = query.toString();
  const endpoint = queryString ? `/companies?${queryString}` : "/companies";

  return apiClient(endpoint);
}

/**
 * Fetch detailed record for a specific company by ID.
 */
export async function getCompanyByIdApi(companyId) {
  return apiClient(`/companies/${companyId}`);
}

/**
 * Onboard a new recruiting company partner.
 */
export async function createCompanyApi(companyData) {
  return apiClient("/companies", {
    method: "POST",
    body: companyData,
  });
}

/**
 * Update an existing company's details or active status.
 */
export async function updateCompanyApi(companyId, updateData) {
  return apiClient(`/companies/${companyId}`, {
    method: "PATCH",
    body: updateData,
  });
}

/**
 * Fetch historical student placements hired by this specific company.
 */
export async function getCompanyPlacementsApi(companyId, params = {}) {
  const query = new URLSearchParams();
  if (params.page) query.append("page", params.page);
  if (params.limit) query.append("limit", params.limit);

  const queryString = query.toString();
  const endpoint = queryString
    ? `/companies/${companyId}/placements?${queryString}`
    : `/companies/${companyId}/placements`;

  return apiClient(endpoint);
}

/**
 * Fetch all registered job roles under a specific company.
 */
export async function getCompanyJobRolesApi(companyId) {
  return apiClient(`/companies/${companyId}/job-roles`);
}

/**
 * Register a new job role under a company.
 */
export async function createCompanyJobRoleApi(companyId, roleData) {
  return apiClient(`/companies/${companyId}/job-roles`, {
    method: "POST",
    body: roleData,
  });
}

/**
 * Update a specific job role.
 */
export async function updateJobRoleApi(jobRoleId, roleData) {
  return apiClient(`/job-roles/${jobRoleId}`, {
    method: "PATCH",
    body: roleData,
  });
}

/**
 * Delete an unreferenced job role.
 */
export async function deleteJobRoleApi(jobRoleId) {
  return apiClient(`/job-roles/${jobRoleId}`, {
    method: "DELETE",
  });
}

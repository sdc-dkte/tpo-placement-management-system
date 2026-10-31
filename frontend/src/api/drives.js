import { apiClient } from "./client";

/**
 * DKTE Placement Management System — Drive Management & Outreach API Client
 * 
 * Complies strictly with DKTE institutional placement rules:
 * - Pure monetary CTC packages (no package tiers)
 * - Lean V1 recruitment workflow & dynamic eligibility engine
 * - Automated Nodemailer outreach integration
 */

/**
 * Fetch list of placement drives with filters and pagination.
 * 
 * Supported query params:
 * - search (string)
 * - status ('UPCOMING' | 'ONGOING' | 'COMPLETED' | 'CANCELLED')
 * - companyId (number)
 * - minPackage (number)
 * - maxPackage (number)
 * - departmentId (number)
 * - graduationYear (number)
 * - sortBy ('createdAt' | 'driveDate' | 'packageLPA' | 'title' | 'status')
 * - sortOrder ('asc' | 'desc')
 * - page (number)
 * - limit (number)
 */
export async function getDrivesApi(params = {}) {
  const query = new URLSearchParams();

  if (params.search && params.search.trim()) {
    query.append("search", params.search.trim());
  }
  if (params.status && params.status !== "ALL") {
    query.append("status", params.status);
  }
  if (params.companyId) {
    query.append("companyId", params.companyId);
  }
  if (params.minPackage !== undefined && params.minPackage !== null) {
    query.append("minPackage", params.minPackage);
  }
  if (params.maxPackage !== undefined && params.maxPackage !== null) {
    query.append("maxPackage", params.maxPackage);
  }
  if (params.departmentId) {
    query.append("departmentId", params.departmentId);
  }
  if (params.graduationYear) {
    query.append("graduationYear", params.graduationYear);
  }
  if (params.sortBy) {
    query.append("sortBy", params.sortBy);
  }
  if (params.sortOrder) {
    query.append("sortOrder", params.sortOrder);
  }
  if (params.page) {
    query.append("page", params.page);
  }
  if (params.limit) {
    query.append("limit", params.limit);
  }

  const qs = query.toString();
  return apiClient(qs ? `/drives?${qs}` : "/drives");
}

/**
 * Fetch detailed record for a single placement drive.
 */
export async function getDriveByIdApi(driveId) {
  return apiClient(`/drives/${driveId}`);
}

/**
 * Create a new campus placement drive with academic eligibility criteria.
 */
export async function createDriveApi(driveData) {
  return apiClient("/drives", {
    method: "POST",
    body: driveData,
  });
}

/**
 * Update drive fields (title, package, date, venue, criteria).
 */
export async function updateDriveApi(driveId, payload) {
  return apiClient(`/drives/${driveId}`, {
    method: "PATCH",
    body: payload,
  });
}

/**
 * Update drive lifecycle status.
 * Valid transitions: UPCOMING -> ONGOING -> COMPLETED
 */
export async function updateDriveStatusApi(driveId, status) {
  return apiClient(`/drives/${driveId}/status`, {
    method: "PATCH",
    body: { status },
  });
}

/**
 * Dynamic Eligibility Engine: Evaluate and retrieve eligible students for a drive.
 * 
 * Supported query params:
 * - statusFilter: 'eligible_only' | 'ineligible_only' | 'all'
 * - search: string (matches PRN, student name, email)
 * - departmentId: number
 * - page: number
 * - limit: number
 */
export async function getEligibleStudentsForDriveApi(driveId, params = {}) {
  const query = new URLSearchParams();

  if (params.statusFilter) query.append("statusFilter", params.statusFilter);
  if (params.search && params.search.trim()) query.append("search", params.search.trim());
  if (params.departmentId) query.append("departmentId", params.departmentId);
  if (params.page) query.append("page", params.page);
  if (params.limit) query.append("limit", params.limit);

  const qs = query.toString();
  return apiClient(qs ? `/drives/${driveId}/eligible-students?${qs}` : `/drives/${driveId}/eligible-students`);
}

/**
 * Student Self-Service: Check current student's personal eligibility for a drive.
 */
export async function getMyDriveEligibilityApi(driveId) {
  return apiClient(`/drives/${driveId}/eligibility/me`);
}

/**
 * Fetch email campaigns associated with a specific placement drive.
 */
export async function getDriveEmailCampaignsApi(driveId) {
  return apiClient(`/email-campaigns?driveId=${driveId}`);
}

/**
 * Create a new student outreach email campaign.
 */
export async function createEmailCampaignApi(campaignData) {
  return apiClient("/email-campaigns", {
    method: "POST",
    body: campaignData,
  });
}

/**
 * Update an existing draft email campaign.
 */
export async function updateEmailCampaignApi(campaignId, updateData) {
  return apiClient(`/email-campaigns/${campaignId}`, {
    method: "PATCH",
    body: updateData,
  });
}

/**
 * Cancel an email campaign.
 */
export async function cancelEmailCampaignApi(campaignId, reason) {
  return apiClient(`/email-campaigns/${campaignId}/cancel`, {
    method: "POST",
    body: { reason },
  });
}

/**
 * Fetch companies list for drive creation selector.
 */
export async function getCompaniesForSelectApi() {
  return apiClient("/companies?limit=100");
}

/**
 * Quick-create a new company directly from the drive creation modal.
 */
export async function createCompanyQuickApi(companyData) {
  return apiClient("/companies", {
    method: "POST",
    body: companyData,
  });
}

/**
 * Fetch job roles belonging to a specific company.
 */
export async function getCompanyJobRolesForSelectApi(companyId) {
  return apiClient(`/companies/${companyId}/job-roles`);
}

/**
 * Quick-create a job role under a company directly from the drive creation modal.
 */
export async function createJobRoleQuickApi(companyId, roleData) {
  return apiClient(`/companies/${companyId}/job-roles`, {
    method: "POST",
    body: roleData,
  });
}

/**
 * Fetch departments list for academic discipline criteria checkboxes.
 */
export async function getDepartmentsForSelectApi() {
  return apiClient("/departments?limit=50");
}

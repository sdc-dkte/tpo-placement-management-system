import { apiClient } from "./client";

/**
 * Fetch high-level executive placement dashboard statistics.
 * Returns:
 * - totalStudents, placedStudents, unplacedStudents, placementPercentage
 * - averagePackage, highestPackage, lowestPackage
 * - upcomingDrives, ongoingDrives
 * - departmentSummaries: array of branch statistics
 */
export async function getDashboardOverviewApi() {
  return apiClient("/dashboard/overview");
}

/**
 * Fetch detailed metrics for a specific department.
 */
export async function getDepartmentOverviewApi(departmentId) {
  return apiClient(`/dashboard/departments/${departmentId}`);
}

/**
 * Fetch recent candidate selections for the executive live feed.
 */
export async function getRecentSelectionsApi(limit = 6) {
  return apiClient(`/selections?limit=${limit}`);
}

/**
 * Fetch upcoming drives for the dashboard schedule board.
 */
export async function getUpcomingDrivesSummaryApi(limit = 5) {
  return apiClient(`/drives?status=UPCOMING&limit=${limit}&sortBy=driveDate&sortOrder=asc`);
}

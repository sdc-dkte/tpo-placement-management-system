import { apiClient } from './client';

/**
 * Authenticate user with institutional email / PRN credentials.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ success: boolean, message: string, token: string, user: { id: number, name: string, email: string, role: string } }>}
 */
export async function loginApi({ email, password }) {
  return apiClient('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
}

/**
 * Retrieve active user profile and academic student details if applicable.
 * @param {string} [token]
 * @returns {Promise<{ success: boolean, user: object }>}
 */
export async function getMeApi(token) {
  return apiClient('/auth/me', {
    method: 'GET',
    token,
  });
}

/**
 * Revoke current session token on backend.
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export async function logoutApi() {
  try {
    return await apiClient('/auth/logout', {
      method: 'POST',
    });
  } catch (error) {
    // If token already invalid/expired, proceed with client cleanup
    console.warn('Logout API notification error:', error);
    return { success: true };
  }
}

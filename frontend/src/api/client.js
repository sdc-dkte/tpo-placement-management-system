/**
 * Centralized API client for DKTE Placement Management System.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export async function apiClient(endpoint, { body, headers = {}, token, ...customConfig } = {}) {
  const config = {
    method: body ? 'POST' : 'GET',
    ...customConfig,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };

  const activeToken = token || localStorage.getItem('tpo_auth_token');
  if (activeToken) {
    config.headers.Authorization = `Bearer ${activeToken}`;
  }

  if (body) {
    config.body = JSON.stringify(body);
  }

  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const response = await fetch(`${API_BASE}${normalizedEndpoint}`, config);

  const data = await response.json().catch(() => ({
    success: false,
    message: 'Invalid response from server.',
  }));

  if (!response.ok) {
    const error = new Error(data.message || `Request failed with status ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

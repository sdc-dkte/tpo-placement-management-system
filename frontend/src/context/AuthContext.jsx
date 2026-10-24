import React, { useState, useEffect, useCallback } from 'react';
import { AuthContext } from './authContextInstance';
import { loginApi, getMeApi, logoutApi } from '../api/auth';

const TOKEN_STORAGE_KEY = 'tpo_auth_token';

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_STORAGE_KEY));
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  // Re-hydrate session on mount if token exists
  useEffect(() => {
    let isMounted = true;

    async function hydrateSession() {
      const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (!storedToken) {
        if (isMounted) {
          setIsLoading(false);
        }
        return;
      }

      try {
        const response = await getMeApi(storedToken);
        if (isMounted && response?.success && response?.user) {
          setUser(response.user);
          setToken(storedToken);
        } else {
          throw new Error('Invalid user profile response');
        }
      } catch (err) {
        console.warn('Session hydration failed:', err.message);
        if (isMounted) {
          localStorage.removeItem(TOKEN_STORAGE_KEY);
          setToken(null);
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    hydrateSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(async ({ email, password, role }) => {
    setIsLoading(true);
    setAuthError(null);
    try {
      const response = await loginApi({ email, password, role });
      if (response.success && response.token) {
        localStorage.setItem(TOKEN_STORAGE_KEY, response.token);
        setToken(response.token);
        setUser(response.user);
        return response;
      }
      throw new Error(response.message || 'Login failed.');
    } catch (err) {
      setAuthError(err.message || 'Failed to authenticate.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutApi();
    } catch {
      // ignore logout network errors
    } finally {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      setToken(null);
      setUser(null);
      setAuthError(null);
    }
  }, []);

  const value = {
    user,
    token,
    isLoading,
    authError,
    isAuthenticated: Boolean(token && user),
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

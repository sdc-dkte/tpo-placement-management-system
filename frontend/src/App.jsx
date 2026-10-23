import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import LoginPage from './pages/auth/LoginPage';
import HomeLandingPage from './pages/home/HomeLandingPage';
import ProtectedRoute from './components/auth/ProtectedRoute';
import PublicOnlyRoute from './components/auth/PublicOnlyRoute';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Authentication Route */}
          <Route element={<PublicOnlyRoute />}>
            <Route path="/login" element={<LoginPage />} />
          </Route>

          {/* Protected Home Route */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<HomeLandingPage />} />
          </Route>

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/useAuth';
import LoginPage from './pages/auth/LoginPage';
import TpoDashboardPage from './pages/tpo/TpoDashboardPage';
import StudentDossierPage from './pages/student/StudentDossierPage';
import ProtectedRoute from './components/auth/ProtectedRoute';
import PublicOnlyRoute from './components/auth/PublicOnlyRoute';

function RootRedirect() {
  const { user } = useAuth();
  if (user?.role === 'STUDENT') {
    return <Navigate to="/portal/dossier" replace />;
  }
  return <Navigate to="/dashboard" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Authentication Route */}
          <Route element={<PublicOnlyRoute />}>
            <Route path="/login" element={<LoginPage />} />
          </Route>

          {/* Protected Routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/dashboard" element={<TpoDashboardPage />} />
            <Route path="/portal/dossier" element={<StudentDossierPage />} />
          </Route>

          {/* Catch-all fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

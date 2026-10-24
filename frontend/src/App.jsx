import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/useAuth';
import LoginPage from './pages/auth/LoginPage';
import TpoDashboardPage from './pages/tpo/TpoDashboardPage';
import TpoDrivesPage from './pages/tpo/TpoDrivesPage';
import TpoCompaniesPage from './pages/tpo/TpoCompaniesPage';
import TpoStudentsPage from './pages/tpo/TpoStudentsPage';
import TpoAnalyticsPage from './pages/tpo/TpoAnalyticsPage';
import TpoSettingsPage from './pages/tpo/TpoSettingsPage';
import StudentDossierPage from './pages/student/StudentDossierPage';
import StudentDrivesPage from './pages/student/StudentDrivesPage';
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
            
            {/* TPO Operations Console */}
            <Route path="/dashboard" element={<TpoDashboardPage />} />
            <Route path="/drives" element={<TpoDrivesPage />} />
            <Route path="/companies" element={<TpoCompaniesPage />} />
            <Route path="/students" element={<TpoStudentsPage />} />
            <Route path="/analytics" element={<TpoAnalyticsPage />} />
            <Route path="/settings" element={<TpoSettingsPage />} />

            {/* Student Portal */}
            <Route path="/portal/dossier" element={<StudentDossierPage />} />
            <Route path="/portal/drives" element={<StudentDrivesPage />} />
          </Route>

          {/* Catch-all fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

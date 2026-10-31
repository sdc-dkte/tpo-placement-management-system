import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/useAuth';
import LoginPage from './pages/auth/LoginPage';
import TpoLayout from './pages/tpo/TpoLayout';
import TpoDashboardPage from './pages/tpo/TpoDashboardPage';
import TpoDrivesPage from './pages/tpo/TpoDrivesPage';
import TpoDriveDetailPage from './pages/tpo/drives/TpoDriveDetailPage';
import TpoCompaniesPage from './pages/tpo/TpoCompaniesPage';
import StudentDirectoryPage from './pages/tpo/student-directory/StudentDirectoryPage';
import TpoAnalyticsPage from './pages/tpo/TpoAnalyticsPage';
import StudentDossierPage from './pages/student/StudentDossierPage';
import StudentDrivesPage from './pages/student/StudentDrivesPage';
import ProtectedRoute from './components/auth/ProtectedRoute';
import PublicOnlyRoute from './components/auth/PublicOnlyRoute';

function RootRedirect() {
  const { user } = useAuth();
  if (user?.role === 'STUDENT') {
    return <Navigate to="/portal/dossier" replace />;
  }
  return <Navigate to="/students" replace />;
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

            {/* TPO Operations Console with Universal Sidebar (TPO Only) */}
            <Route element={<ProtectedRoute allowedRoles={['TPO']} />}>
              <Route element={<TpoLayout />}>
                <Route path="/dashboard" element={<TpoDashboardPage />} />
                <Route path="/drives" element={<TpoDrivesPage />} />
                <Route path="/drives/:driveId" element={<TpoDriveDetailPage />} />
                <Route path="/companies" element={<TpoCompaniesPage />} />
                <Route path="/students" element={<StudentDirectoryPage />} />
                <Route path="/analytics" element={<TpoAnalyticsPage />} />

                {/* /tpo/* aliases for backwards compatibility */}
                <Route path="/tpo/dashboard" element={<Navigate to="/dashboard" replace />} />
                <Route path="/tpo/students" element={<Navigate to="/students" replace />} />
                <Route path="/tpo/drives" element={<Navigate to="/drives" replace />} />
                <Route path="/tpo/companies" element={<Navigate to="/companies" replace />} />
                <Route path="/tpo/analytics" element={<Navigate to="/analytics" replace />} />
              </Route>
            </Route>

            {/* Student Read-Only Portal (Student Only) */}
            <Route element={<ProtectedRoute allowedRoles={['STUDENT']} />}>
              <Route path="/portal/dossier" element={<StudentDossierPage />} />
              <Route path="/portal/drives" element={<StudentDrivesPage />} />
            </Route>
          </Route>

          {/* Catch-all fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

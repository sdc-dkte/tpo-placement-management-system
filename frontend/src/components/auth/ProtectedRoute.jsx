import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import { Loader2 } from 'lucide-react';

export default function ProtectedRoute({ allowedRoles }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="flex flex-col items-center space-y-3">
          <Loader2 className="w-6 h-6 animate-spin text-[#111827]" />
          <span className="text-xs text-gray-500 font-medium tracking-wide">
            Verifying session...
          </span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Role-based access control: enforce permissions if allowedRoles specified
  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user?.role)) {
    if (user?.role === 'STUDENT') {
      return <Navigate to="/portal/dossier" replace />;
    }
    if (user?.role === 'TPO') {
      return <Navigate to="/students" replace />;
    }
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

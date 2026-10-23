import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import { Loader2 } from 'lucide-react';

export default function PublicOnlyRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="flex flex-col items-center space-y-3">
          <Loader2 className="w-6 h-6 animate-spin text-[#111827]" />
          <span className="text-xs text-gray-500 font-medium tracking-wide">
            Loading...
          </span>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

import React from 'react';

/**
 * Student Directory & Roster (/students)
 * Full candidate search, CGPA & backlog filters, student dossier drawer.
 * Access: TPO Admin / Staff
 */
export default function TpoStudentsPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Student Directory & Roster</h1>
      <p className="text-sm text-gray-600 mt-1">
        Full student roster, academic eligibility filtering, and candidate placement dossier inspection.
      </p>
    </div>
  );
}

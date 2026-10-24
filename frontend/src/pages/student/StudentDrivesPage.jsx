import React from 'react';

/**
 * Drives Noticeboard (/portal/drives)
 * Eligible upcoming campus drives, assessment schedule, CCF venue.
 * Access: Student
 */
export default function StudentDrivesPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Drives Noticeboard</h1>
      <p className="text-sm text-gray-600 mt-1">
        Browse eligible campus recruitment drives, test slots, and interview schedules.
      </p>
    </div>
  );
}

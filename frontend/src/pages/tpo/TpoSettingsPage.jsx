import React from 'react';

/**
 * System Settings & CSV Ingest (/settings)
 * Master student CSV upload, AY rollover, policy configurations.
 * Access: TPO Admin / Staff
 */
export default function TpoSettingsPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 tracking-tight">System Settings & Data Ingest</h1>
      <p className="text-sm text-gray-600 mt-1">
        Configure academic year parameters, policy thresholds, and master student CSV data ingestion.
      </p>
    </div>
  );
}

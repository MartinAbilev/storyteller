import React from 'react';

interface StatusDisplayProps {
  progressPercent: string;
  completedSteps: number;
  totalSteps: number;
  status: string;
  error: string;
  rawError: string;
  saveStatus: string | null;
  saveStatusType: 'success' | 'error' | null;
}

export const StatusDisplay: React.FC<StatusDisplayProps> = ({
  progressPercent,
  completedSteps,
  totalSteps,
  status,
  error,
  rawError,
  saveStatus,
  saveStatusType,
}) => {
  return (
    <>
      <div className="bg-gray-200 rounded-full h-4">
        <div className="bg-blue-600 h-4 rounded-full" style={{ width: `${progressPercent}%` }}></div>
      </div>
      <p className="text-sm text-gray-600">Progress: {completedSteps}/{totalSteps} steps ({progressPercent}%)</p>

      {status && <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded">{status}</div>}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p>{error}</p>
          {rawError && (
            <details className="mt-2">
              <summary className="cursor-pointer text-sm">Raw Error Response</summary>
              <pre className="text-xs bg-gray-100 p-2 rounded mt-1">{rawError}</pre>
            </details>
          )}
        </div>
      )}
      {saveStatus && (
        <div className={`px-4 py-2 rounded ${saveStatusType === 'success' ? 'bg-green-100 border border-green-400 text-green-700' : 'bg-yellow-100 border border-yellow-400 text-yellow-700'}`}>
          {saveStatus}
        </div>
      )}
    </>
  );
};

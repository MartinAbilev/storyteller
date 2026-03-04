import React from 'react';

interface CondensedDraftSectionProps {
  condensedDraft: string;
  currentStep: number;
  editingSummaryPrompt: boolean;
  summaryPrompt: string;
  setSummaryPrompt: (prompt: string) => void;
  setEditingSummaryPrompt: (editing: boolean) => void;
  isLoading: boolean;
  handleEditSummaryPrompt: () => void;
  handleSaveSummaryPrompt: () => void;
  regenerateSummary: () => void;
}

export const CondensedDraftSection: React.FC<CondensedDraftSectionProps> = ({
  condensedDraft,
  currentStep,
  editingSummaryPrompt,
  summaryPrompt,
  setSummaryPrompt,
  setEditingSummaryPrompt,
  isLoading,
  handleEditSummaryPrompt,
  handleSaveSummaryPrompt,
  regenerateSummary,
}) => {
  if (!condensedDraft) return null;

  return (
    <details open={currentStep === 1} className="bg-white p-6 rounded-lg shadow-md">
      <summary className="cursor-pointer font-medium text-blue-600 mb-2">Step 1: Condensed Draft</summary>
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-semibold text-gray-800">Custom Prompt</h3>
        <div className="flex space-x-2">
          {!editingSummaryPrompt && (
            <button onClick={handleEditSummaryPrompt} className="text-blue-600 hover:text-blue-800">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          )}
          {condensedDraft && (
            <button
              onClick={regenerateSummary}
              disabled={isLoading}
              className="px-4 py-1 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 disabled:opacity-50"
            >
              Regenerate Summary
            </button>
          )}
        </div>
      </div>
      {editingSummaryPrompt ? (
        <div className="mb-4">
          <textarea
            value={summaryPrompt}
            onChange={(e) => setSummaryPrompt(e.target.value)}
            placeholder="Enter custom prompt for summarization (e.g., 'Character A is female, Character B is male, emphasize dramatic themes')"
            className="w-full p-2 border border-gray-300 rounded-md"
          />
          <button
            onClick={handleSaveSummaryPrompt}
            className="mt-2 px-4 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Save Prompt
          </button>
        </div>
      ) : (
        <p className="text-sm text-gray-600 mb-4">{summaryPrompt || 'No custom prompt set'}</p>
      )}
      <div className="prose max-w-none text-gray-700">
        <p>{condensedDraft}</p>
      </div>
    </details>
  );
};

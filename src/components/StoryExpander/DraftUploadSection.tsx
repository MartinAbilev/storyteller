import React from 'react';
import { MODEL_OPTIONS, GLOBAL_IMAGE_STYLE } from './constants';

interface DraftUploadSectionProps {
  draft: string;
  setDraft: (draft: string) => void;
  model: string;
  setModel: (model: string) => void;
  globalImageStyle: string;
  setGlobalImageStyle: (style: string) => void;
  editingImageStyle: boolean;
  setEditingImageStyle: (editing: boolean) => void;
  isLoading: boolean;
  currentStep: number;
  handleSubmit: (e: React.FormEvent) => void;
  handleContinue: () => void;
  clearProgress: () => void;
  handleRefreshImageStyle: () => void;
  pendingStyleChangeRef: React.MutableRefObject<boolean>;
  saveProgress: () => void;
}

export const DraftUploadSection: React.FC<DraftUploadSectionProps> = ({
  draft,
  setDraft,
  model,
  setModel,
  globalImageStyle,
  setGlobalImageStyle,
  editingImageStyle,
  setEditingImageStyle,
  isLoading,
  currentStep,
  handleSubmit,
  handleContinue,
  clearProgress,
  handleRefreshImageStyle,
  pendingStyleChangeRef,
  saveProgress,
}) => {
  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Paste Your Initial Draft (90 pages? Epic!):
      </label>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Enter your story draft..."
        className="w-full h-40 p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-vertical"
        required
      />
      <div className="mt-4 flex items-center space-x-2">
        <label htmlFor="model" className="text-sm text-gray-600">Select Model:</label>
        <select
          id="model"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-1 text-sm"
        >
          {MODEL_OPTIONS.map((option: any) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Global Image Style Editor */}
      <div className="mt-4 p-4 bg-blue-50 rounded-md border border-blue-200">
        <div className="flex items-center justify-between mb-2">
          <div>
            <label className="text-sm font-medium text-gray-700">Image Generation Style:</label>
            <p className="text-xs text-gray-500 mt-1">Auto-generated from your draft • Adjust if needed</p>
          </div>
          {!editingImageStyle && (
            <div className="flex gap-2 ml-4">
              {globalImageStyle && (
                <button
                  type="button"
                  onClick={handleRefreshImageStyle}
                  disabled={isLoading}
                  className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded disabled:opacity-50"
                  title="Refresh style from draft"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              )}
              {globalImageStyle && (
                <button
                  type="button"
                  onClick={() => setEditingImageStyle(true)}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap"
                >
                  ✎ Edit
                </button>
              )}
            </div>
          )}
        </div>
        {editingImageStyle ? (
          <div>
            <textarea
              value={globalImageStyle}
              onChange={(e) => setGlobalImageStyle(e.target.value)}
              placeholder="Enter image style description (e.g., 'Digital illustration, cinematic lighting, dramatic atmosphere...')"
              className="w-full h-24 p-2 border border-gray-300 rounded-md text-sm resize-vertical"
            />
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  pendingStyleChangeRef.current = true;
                  setEditingImageStyle(false);
                  saveProgress();
                }}
                className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
              >
                Save Style
              </button>
              <button
                type="button"
                onClick={() => {
                  pendingStyleChangeRef.current = true;
                  setGlobalImageStyle(GLOBAL_IMAGE_STYLE);
                  setEditingImageStyle(false);
                  saveProgress();
                }}
                className="px-3 py-1 bg-gray-400 text-white rounded-md hover:bg-gray-500 text-sm"
              >
                Reset to Default
              </button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-700 italic line-clamp-3 bg-white p-2 rounded border border-gray-200">{globalImageStyle || 'Paste your draft and click "Start Expansion" to auto-generate a style, or set it manually'}</p>
        )}
      </div>

      <div className="mt-4 flex space-x-4">
        <button
          type="submit"
          disabled={isLoading || !draft.trim()}
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {currentStep > 0 ? 'Resume Expansion' : 'Start Expansion'}
        </button>
        <button
          type="button"
          onClick={handleContinue}
          disabled={isLoading}
          className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
        >
          Continue
        </button>
        <button
          type="button"
          onClick={clearProgress}
          className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
        >
          Clear Progress
        </button>
      </div>
    </form>
  );
};

import React from 'react';
import { Chapter } from './constants';

interface OutlineSectionProps {
  chapters: Chapter[];
  currentStep: number;
  editingOutlinePrompt: boolean;
  outlinePrompt: string;
  summaryPrompt: string;
  setOutlinePrompt: (prompt: string) => void;
  setEditingOutlinePrompt: (editing: boolean) => void;
  editingChapterPrompt: number | null;
  chapterPrompts: string[];
  setChapterPrompts: (prompts: string[]) => void;
  setEditingChapterPrompt: (index: number | null) => void;
  isLoading: boolean;
  handleEditOutlinePrompt: () => void;
  handleSaveOutlinePrompt: () => void;
  handleRegenerateOutline: () => void;
  handleEditChapterPrompt: (index: number) => void;
  handleSaveChapterPrompt: (index: number) => void;
}

export const OutlineSection: React.FC<OutlineSectionProps> = ({
  chapters,
  currentStep,
  editingOutlinePrompt,
  outlinePrompt,
  summaryPrompt,
  setOutlinePrompt,
  setEditingOutlinePrompt,
  editingChapterPrompt,
  chapterPrompts,
  setChapterPrompts,
  setEditingChapterPrompt,
  isLoading,
  handleEditOutlinePrompt,
  handleSaveOutlinePrompt,
  handleRegenerateOutline,
  handleEditChapterPrompt,
  handleSaveChapterPrompt,
}) => {
  if (chapters.length === 0) return null;

  return (
    <details open={currentStep === 3} className="bg-white p-6 rounded-lg shadow-md">
      <summary className="cursor-pointer font-medium text-blue-600 mb-2">Step 3: Chapter Outlines</summary>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h4 className="font-semibold text-gray-800">Outline Custom Prompt</h4>
          {!editingOutlinePrompt ? (
            <div className="flex items-center space-x-2">
              <p className="text-sm text-gray-600 italic mr-4">{outlinePrompt || summaryPrompt || 'No outline prompt set'}</p>
              <button onClick={handleEditOutlinePrompt} className="text-blue-600 hover:text-blue-800">Edit</button>
            </div>
          ) : (
            <div>
              <textarea
                value={outlinePrompt}
                onChange={(e) => setOutlinePrompt(e.target.value)}
                placeholder="Enter custom prompt for outline generation (e.g., 'Focus on political intrigue')"
                className="w-full p-2 border border-gray-300 rounded-md mb-2"
              />
              <button onClick={handleSaveOutlinePrompt} className="px-3 py-1 bg-blue-600 text-white rounded-md">Save Prompt</button>
            </div>
          )}
        </div>
        <div>
          <button
            onClick={handleRegenerateOutline}
            disabled={isLoading}
            className="px-4 py-1 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 disabled:opacity-50"
          >
            {isLoading ? 'Regenerating...' : 'Regenerate Outline'}
          </button>
        </div>
      </div>
      <ul className="space-y-4 mt-4">
        {chapters.map((chapter, idx) => (
          <li key={idx} className="border-l-4 border-blue-500 pl-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-gray-800">{chapter.title}</h3>
              <button onClick={() => handleEditChapterPrompt(idx)} className="text-blue-600 hover:text-blue-800">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            </div>
            {editingChapterPrompt === idx ? (
              <div className="mb-4">
                <textarea
                  value={chapterPrompts[idx] || ''}
                  onChange={(e) => {
                    const newPrompts = [...chapterPrompts];
                    newPrompts[idx] = e.target.value;
                    setChapterPrompts(newPrompts);
                  }}
                  placeholder="Enter custom prompt for this chapter (e.g., 'Make Character A the villain, focus on betrayal')"
                  className="w-full p-2 border border-gray-300 rounded-md"
                />
                <button
                  onClick={() => handleSaveChapterPrompt(idx)}
                  className="mt-2 px-4 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Save Prompt
                </button>
              </div>
            ) : (
              <p className="text-sm text-gray-600 italic mb-2">Custom Prompt: {chapterPrompts[idx] || 'None'}</p>
            )}
            <p className="text-sm text-gray-600 italic mb-2">Summary: {chapter.summary}</p>
            <h4 className="font-medium">Key Events</h4>
            <ul className="list-disc pl-5">
              {Array.isArray(chapter.keyEvents) && chapter.keyEvents.length > 0 ? (
                chapter.keyEvents.map((event, eIdx) => <li key={eIdx}>{event}</li>)
              ) : (
                <li>No key events available.</li>
              )}
            </ul>
            <h4 className="font-medium">Character Traits</h4>
            <ul className="list-disc pl-5">
              {Array.isArray(chapter.characterTraits) && chapter.characterTraits.length > 0 ? (
                chapter.characterTraits.map((trait, tIdx) => <li key={tIdx}>{trait}</li>)
              ) : (
                <li>No character traits available.</li>
              )}
            </ul>
            <h4 className="font-medium">Timeline</h4>
            <p>{chapter.timeline || 'No timeline available.'}</p>
          </li>
        ))}
      </ul>
    </details>
  );
};

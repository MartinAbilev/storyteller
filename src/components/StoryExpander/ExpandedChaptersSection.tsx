import React from 'react';
import { Chapter } from './constants';

interface ExpandedChaptersSectionProps {
  chapters: Chapter[];
  expandedChapters: string[];
  expansionCounts: number[];
  chapterPrompts: string[];
  currentStep: number;
  editingChapterPrompt: number | null;
  chapterLoading: number | null;
  chapterImageLoading: number | null;
  chapterImagePromptLoading: number | null;
  setChapterPrompts: (prompts: string[]) => void;
  setEditingChapterPrompt: (index: number | null) => void;
  handleEditChapterPrompt: (index: number) => void;
  handleSaveChapterPrompt: (index: number) => void;
  handleExpandMore: (index: number) => void;
  handleRegenerateChapter: (index: number) => void;
  handleRegenerateExpandedFromChapter: (index: number) => void;
  handleRegenerateChapterImage: (index: number) => void;
  handleRegenerateChapterImagePrompt: (index: number) => void;
  setPreviewChapterIndex: (index: number | null) => void;
}

export const ExpandedChaptersSection: React.FC<ExpandedChaptersSectionProps> = ({
  chapters,
  expandedChapters,
  expansionCounts,
  chapterPrompts,
  currentStep,
  editingChapterPrompt,
  chapterLoading,
  chapterImageLoading,
  chapterImagePromptLoading,
  setChapterPrompts,
  setEditingChapterPrompt,
  handleEditChapterPrompt,
  handleSaveChapterPrompt,
  handleExpandMore,
  handleRegenerateChapter,
  handleRegenerateExpandedFromChapter,
  handleRegenerateChapterImage,
  handleRegenerateChapterImagePrompt,
  setPreviewChapterIndex,
}) => {
  if (!expandedChapters.some(ch => ch)) return null;

  return (
    <details open={currentStep === 3} className="bg-white p-6 rounded-lg shadow-md">
      <summary className="cursor-pointer font-medium text-blue-600 mb-2">Step 4: Expanded Chapters</summary>
      <div className="space-y-6">
        {chapters.map((chapter, idx) => (
          expandedChapters[idx] && (
            <div key={idx} className="border-l-4 border-blue-500 pl-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-gray-800">{chapter.title} {expansionCounts[idx] > 0 && ` (Expanded ${expansionCounts[idx]}x)`}</h3>
                <div className="flex space-x-2">
                  <button onClick={() => handleEditChapterPrompt(idx)} className="text-blue-600 hover:text-blue-800">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleExpandMore(idx)}
                    disabled={chapterLoading !== null}
                    className="px-4 py-1 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50"
                  >
                    {chapterLoading === idx ? 'Expanding...' : 'Expand More'}
                  </button>
                  <button
                    onClick={() => handleRegenerateChapter(idx)}
                    disabled={chapterLoading !== null}
                    className="px-4 py-1 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 disabled:opacity-50 ml-2"
                  >
                    {chapterLoading === idx ? 'Regenerating...' : 'Regenerate'}
                  </button>
                  {idx < chapters.length - 1 && (
                    <button
                      onClick={() => handleRegenerateExpandedFromChapter(idx + 1)}
                      disabled={chapterLoading !== null}
                      className="px-4 py-1 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 ml-2"
                      title="Regenerate expanded chapters from this chapter onwards"
                    >
                      Regen From
                    </button>
                  )}
                </div>
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
              {chapter.imageUrl && (
                <div className="my-4">
                  <img
                    src={chapter.imageUrl}
                    alt={`Illustration for ${chapter.title}`}
                    className="w-full max-w-2xl rounded-lg shadow-md"
                  />
                  <div className="mt-2 flex items-center gap-3">
                    <button
                      onClick={() => handleRegenerateChapterImage(idx)}
                      disabled={chapterImageLoading !== null}
                      className="px-3 py-1 bg-sky-600 text-white rounded-md hover:bg-sky-700 disabled:opacity-50"
                    >
                      {chapterImageLoading === idx ? 'Regenerating...' : 'Regenerate Image'}
                    </button>
                    <button
                      onClick={() => handleRegenerateChapterImagePrompt(idx)}
                      disabled={chapterImagePromptLoading !== null}
                      className="px-2 py-1 text-xs border border-gray-300 rounded-md text-gray-600 hover:text-gray-800 hover:border-gray-400 disabled:opacity-50"
                    >
                      {chapterImagePromptLoading === idx ? 'Regenerating...' : 'Regen Prompt'}
                    </button>
                    {chapter.imagePrompt && (
                      <p className="text-xs text-gray-500 italic">Image prompt: {chapter.imagePrompt}</p>
                    )}
                  </div>
                </div>
              )}
              <div className="prose max-w-none text-gray-700">
                <p>{expandedChapters[idx]}</p>
              </div>
            </div>
          )
        ))}
      </div>
    </details>
  );
};

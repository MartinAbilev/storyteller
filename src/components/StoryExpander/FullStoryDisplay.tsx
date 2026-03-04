import React from 'react';
import { Chapter } from './constants';

interface FullStoryDisplayProps {
  fullStory: string;
  chapters: Chapter[];
  expandedChapters: string[];
  currentStep: number;
  currentChapterIndex: number;
  bookTitle: string;
  coverImage: string;
  coverGenerationInProgress: boolean;
  chapterImageLoading: number | null;
  setCoverGenerationInProgress: (loading: boolean) => void;
  setCoverImage: (image: string) => void;
  setIsPreviewingFullBook: (previewing: boolean) => void;
  setPreviewChapterIndex: (index: number | null) => void;
  generateCoverImage: (force?: boolean) => void;
  handleRegenerateAllImages: () => void;
  handleRegenerateChapterImage: (index: number) => void;
  handleRegenerateChapterImagePrompt: (index: number) => void;
  handleCopyWithImages: (htmlContent: string, imageUrls: string[]) => void;
}

export const FullStoryDisplay: React.FC<FullStoryDisplayProps> = ({
  fullStory,
  chapters,
  expandedChapters,
  currentStep,
  currentChapterIndex,
  bookTitle,
  coverImage,
  coverGenerationInProgress,
  chapterImageLoading,
  setCoverGenerationInProgress,
  setCoverImage,
  setIsPreviewingFullBook,
  setPreviewChapterIndex,
  generateCoverImage,
  handleRegenerateAllImages,
  handleRegenerateChapterImage,
  handleRegenerateChapterImagePrompt,
  handleCopyWithImages,
}) => {
  if (!fullStory || !chapters.some((_, idx) => expandedChapters[idx])) {
    return null;
  }

  return (
    <details open={currentStep === 3 && currentChapterIndex >= chapters.length} className="bg-white p-8 rounded-lg shadow-md">
      <summary className="cursor-pointer font-medium text-blue-600 mb-4">Final Expanded Story (Book Format)</summary>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3 mb-4 no-print">
        {expandedChapters.every(ch => ch) && (
          <button
            onClick={() => {
              setCoverGenerationInProgress(true);
              setCoverImage('');
              setTimeout(() => generateCoverImage(true), 100);
            }}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            {coverImage ? 'Regenerate' : 'Generate'} Cover Image
          </button>
        )}
        {expandedChapters.every(ch => ch) && (
          <button
            onClick={() => handleRegenerateAllImages()}
            disabled={chapterImageLoading !== null || coverGenerationInProgress}
            className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {coverGenerationInProgress || chapterImageLoading !== null ? 'Regenerating...' : 'Regenerate All Images'}
          </button>
        )}
        {expandedChapters.every(ch => ch) && (
          <button
            onClick={() => setIsPreviewingFullBook(true)}
            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
          >
            Preview Book
          </button>
        )}
        {expandedChapters.every(ch => ch) && (
          <button
            onClick={() => {
              const chaptersHtml = chapters.map((ch, idx) => `
                <h2>Chapter ${idx + 1}: ${ch.title}</h2>
                ${ch.imageUrl ? `<img src="${ch.imageUrl}" alt="Chapter ${idx + 1}: ${ch.title}">` : ''}
                ${expandedChapters[idx]?.split('\n\n').map(para => `<p>${para}</p>`).join('') || ''}
              `).join('');

              const toc = chapters.map((ch, idx) => `<li>Chapter ${idx + 1}: ${ch.title}</li>`).join('');

              const htmlContent = `
                <h1>${bookTitle || 'Novel'}</h1>
                <p>${chapters.length} Chapters</p>
                <h2>Table of Contents</h2>
                <ul>${toc}</ul>
                ${chaptersHtml}
                <p>~ The End ~</p>
              `;

              const imageUrls = [
                ...(coverImage ? [coverImage] : []),
                ...chapters.map(ch => ch.imageUrl).filter((url): url is string => !!url)
              ];

              handleCopyWithImages(htmlContent, imageUrls);
            }}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            📋 Copy All (with Images)
          </button>
        )}
      </div>

      {/* Book-style formatted content */}
      <div className="book-content max-w-4xl mx-auto bg-white">
        {/* Cover Page */}
        <div className="mb-12 text-center page-break">
          {coverImage ? (
            <div className="relative inline-block max-w-2xl mx-auto mb-6">
              <img
                src={coverImage}
                alt="Book Cover"
                className="w-full rounded-lg shadow-2xl"
              />
              {/* Title overlay on cover image */}
              <div className="absolute inset-0 flex items-center justify-center p-8">
                <h1
                  className="text-5xl md:text-6xl font-bold text-white text-center"
                  style={{
                    textShadow: '0 4px 12px rgba(0,0,0,0.9), 0 2px 4px rgba(0,0,0,0.8), 0 0 20px rgba(0,0,0,0.7)',
                    lineHeight: '1.2'
                  }}
                >
                  {bookTitle || 'Complete Story'}
                </h1>
              </div>
            </div>
          ) : (
            <h1 className="text-4xl font-bold text-gray-900 mb-2">{bookTitle || 'Complete Story'}</h1>
          )}
          <p className="text-lg text-gray-600">{chapters.length} Chapters</p>
        </div>

        {/* Table of Contents */}
        <div className="mb-12 page-break">
          <h2 className="text-3xl font-bold text-gray-900 mb-6 border-b-2 border-gray-300 pb-2">Table of Contents</h2>
          <ul className="space-y-2">
            {chapters.map((ch, idx) => (
              <li key={idx} className="text-gray-700">
                <span className="font-semibold">Chapter {idx + 1}:</span> {ch.title}
              </li>
            ))}
          </ul>
        </div>

        {/* Chapters */}
        {chapters.map((ch, idx) => (
          expandedChapters[idx] && (
            <div key={idx} className="mb-16 page-break-before">
              <div className="mb-6 avoid-break">
                <p className="text-sm text-gray-500 uppercase tracking-wide mb-2">Chapter {idx + 1}</p>
                <h2 className="text-3xl font-bold text-gray-900 mb-6">{ch.title}</h2>
              </div>

              {/* Chapter Image */}
              {ch.imageUrl && (
                <div className="mb-6 avoid-break">
                  <img
                    src={ch.imageUrl}
                    alt={`Chapter ${idx + 1}: ${ch.title}`}
                    className="w-full rounded-lg shadow-lg"
                  />
                  <div className="mt-2 flex flex-wrap items-center gap-3 no-print">
                    <button
                      onClick={() => handleRegenerateChapterImage(idx)}
                      disabled={chapterImageLoading !== null}
                      className="px-3 py-1 bg-sky-600 text-white rounded-md hover:bg-sky-700 disabled:opacity-50"
                    >
                      {chapterImageLoading === idx ? 'Regenerating...' : 'Regenerate Image'}
                    </button>
                    <button
                      onClick={() => handleRegenerateChapterImagePrompt(idx)}
                      disabled={chapterImageLoading !== null}
                      className="px-2 py-1 text-xs border border-gray-300 rounded-md text-gray-600 hover:text-gray-800 hover:border-gray-400 disabled:opacity-50"
                    >
                      {chapterImageLoading === idx ? 'Regenerating...' : 'Regen Prompt'}
                    </button>
                    <button
                      onClick={() => setPreviewChapterIndex(idx)}
                      className="px-2 py-1 text-xs border border-purple-300 rounded-md text-purple-600 hover:text-purple-800 hover:border-purple-400 hover:bg-purple-50"
                    >
                      Preview
                    </button>
                    {ch.imagePrompt && (
                      <p className="text-xs text-gray-500 italic">Image prompt: {ch.imagePrompt}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Chapter Content */}
              <div className="prose prose-lg max-w-none leading-relaxed text-gray-800">
                {expandedChapters[idx].split('\n\n').map((paragraph, pIdx) => (
                  <p key={pIdx} className="mb-4 text-justify indent-8">{paragraph}</p>
                ))}
              </div>

              {idx < chapters.length - 1 && (
                <div className="mt-8 border-b-2 border-gray-200 no-print"></div>
              )}
            </div>
          )
        ))}

        {/* End Page */}
        <div className="text-center py-12 page-break-before">
          <p className="text-2xl font-serif text-gray-600">~ The End ~</p>
        </div>
      </div>
    </details>
  );
};

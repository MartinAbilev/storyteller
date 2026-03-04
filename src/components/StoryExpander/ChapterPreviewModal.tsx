import React from 'react';
import { Chapter } from './constants';

interface ChapterPreviewModalProps {
  previewChapterIndex: number | null;
  chapters: Chapter[];
  expandedChapters: string[];
  setPreviewChapterIndex: (index: number | null) => void;
  handleCopyWithImages: (htmlContent: string, imageUrls: string[]) => void;
  handleOpenChapterPreview: (index: number) => void;
}

export const ChapterPreviewModal: React.FC<ChapterPreviewModalProps> = ({
  previewChapterIndex,
  chapters,
  expandedChapters,
  setPreviewChapterIndex,
  handleCopyWithImages,
  handleOpenChapterPreview,
}) => {
  if (previewChapterIndex === null || !chapters[previewChapterIndex] || !expandedChapters[previewChapterIndex]) {
    return null;
  }

  const chapter = chapters[previewChapterIndex];
  const chapterContent = expandedChapters[previewChapterIndex];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-3xl my-8">
        {/* Close Button */}
        <div className="sticky top-0 flex justify-between items-center p-6 bg-white border-b border-gray-200 rounded-t-lg">
          <h2 className="text-2xl font-bold text-gray-800">{chapter.title}</h2>
          <button
            onClick={() => setPreviewChapterIndex(null)}
            className="text-gray-500 hover:text-gray-700 text-2xl font-bold w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
          >
            ✕
          </button>
        </div>

        {/* Preview Content */}
        <div className="p-8 max-h-[70vh] overflow-y-auto">
          {/* Chapter Image */}
          {chapter.imageUrl && (
            <div className="mb-6">
              <img
                src={chapter.imageUrl}
                alt={`Chapter ${previewChapterIndex + 1}: ${chapter.title}`}
                className="w-full rounded-lg shadow-md"
              />
            </div>
          )}

          {/* Chapter Text */}
          <div className="prose prose-lg max-w-none leading-relaxed text-gray-800">
            {chapterContent.split('\n\n').map((paragraph, pIdx) => (
              <p key={pIdx} className="mb-4 text-justify indent-8 leading-loose">{paragraph}</p>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 p-6 bg-gray-50 border-t border-gray-200 rounded-b-lg flex justify-end gap-3">
          <button
            onClick={() => {
              const htmlContent = `
                <h2>${chapter.title}</h2>
                ${chapter.imageUrl ? `<img src="${chapter.imageUrl}" alt="Chapter ${previewChapterIndex + 1}: ${chapter.title}">` : ''}
                ${chapterContent.split('\n\n').map(para => `<p>${para}</p>`).join('')}
              `;
              const imageUrls = chapter.imageUrl ? [chapter.imageUrl] : [];
              handleCopyWithImages(htmlContent, imageUrls);
            }}
            className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            📋 Copy (with Images)
          </button>
          <button
            onClick={() => handleOpenChapterPreview(previewChapterIndex)}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Open in New Tab
          </button>
          <button
            onClick={() => setPreviewChapterIndex(null)}
            className="px-6 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { Chapter } from './constants';

interface FullBookPreviewModalProps {
  isPreviewingFullBook: boolean;
  chapters: Chapter[];
  expandedChapters: string[];
  bookTitle: string;
  coverImage: string;
  setIsPreviewingFullBook: (previewing: boolean) => void;
  handleCopyWithImages: (htmlContent: string, imageUrls: string[]) => void;
  handleOpenFullBookPreview: () => void;
}

export const FullBookPreviewModal: React.FC<FullBookPreviewModalProps> = ({
  isPreviewingFullBook,
  chapters,
  expandedChapters,
  bookTitle,
  coverImage,
  setIsPreviewingFullBook,
  handleCopyWithImages,
  handleOpenFullBookPreview,
}) => {
  if (!isPreviewingFullBook || chapters.length === 0 || !expandedChapters.some(ch => ch)) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl my-8">
        {/* Close Button */}
        <div className="sticky top-0 flex justify-between items-center p-6 bg-white border-b border-gray-200 rounded-t-lg">
          <h2 className="text-2xl font-bold text-gray-800">{bookTitle || 'Preview Book'}</h2>
          <button
            onClick={() => setIsPreviewingFullBook(false)}
            className="text-gray-500 hover:text-gray-700 text-2xl font-bold w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
          >
            ✕
          </button>
        </div>

        {/* Preview Content */}
        <div className="p-8 max-h-[80vh] overflow-y-auto">
          {/* Cover Page */}
          <div className="mb-12 text-center pb-8 border-b-2 border-gray-200">
            {coverImage ? (
              <div className="relative inline-block max-w-2xl mx-auto mb-6">
                <img
                  src={coverImage}
                  alt="Book Cover"
                  className="w-full rounded-lg shadow-2xl"
                />
              </div>
            ) : (
              <div className="bg-gray-200 rounded-lg w-64 h-80 mx-auto mb-6 flex items-center justify-center">
                <span className="text-gray-400">No cover image</span>
              </div>
            )}
            <h1 className="text-5xl font-bold text-gray-900 mb-2">{bookTitle || 'Novel'}</h1>
          </div>

          {/* Table of Contents */}
          <div className="mb-12 pb-8 border-b-2 border-gray-200">
            <h2 className="text-3xl font-bold text-gray-800 mb-4">Table of Contents</h2>
            <ul className="space-y-2 text-lg text-gray-700">
              {chapters.map((ch, idx) => (
                <li key={idx} className="flex justify-between">
                  <span>Chapter {idx + 1}: {ch.title}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* All Chapters */}
          {chapters.map((ch, idx) => (
            <div key={idx} className="mb-12 pb-8">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">Chapter {idx + 1}: {ch.title}</h2>

              {/* Chapter Image */}
              {ch.imageUrl && (
                <div className="mb-6">
                  <img
                    src={ch.imageUrl}
                    alt={`Chapter ${idx + 1}: ${ch.title}`}
                    className="w-full rounded-lg shadow-lg"
                  />
                </div>
              )}

              {/* Chapter Content */}
              <div className="prose prose-lg max-w-none leading-relaxed text-gray-800">
                {expandedChapters[idx].split('\n\n').map((paragraph, pIdx) => (
                  <p key={pIdx} className="mb-4 text-justify indent-8 leading-loose">{paragraph}</p>
                ))}
              </div>

              {idx < chapters.length - 1 && (
                <div className="mt-8 border-b-2 border-gray-200"></div>
              )}
            </div>
          ))}

          {/* End Page */}
          <div className="text-center py-12">
            <p className="text-2xl font-serif text-gray-600">~ The End ~</p>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 p-6 bg-gray-50 border-t border-gray-200 rounded-b-lg flex justify-end gap-3">
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
            className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            📋 Copy (with Images)
          </button>
          <button
            onClick={() => handleOpenFullBookPreview()}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Open in New Tab
          </button>
          <button
            onClick={() => setIsPreviewingFullBook(false)}
            className="px-6 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

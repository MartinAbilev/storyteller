import React from 'react';

interface ScreenplayModalProps {
  isOpen: boolean;
  screenplay: string;
  bookTitle: string;
  onClose: () => void;
  onRegenerate: () => void;
  isGenerating: boolean;
}

export const ScreenplayModal: React.FC<ScreenplayModalProps> = ({
  isOpen,
  screenplay,
  bookTitle,
  onClose,
  onRegenerate,
  isGenerating,
}) => {
  if (!isOpen) return null;

  const copyScreenplay = async () => {
    await navigator.clipboard.writeText(screenplay);
  };

  const downloadScreenplay = () => {
    const blob = new Blob([screenplay], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(bookTitle || 'screenplay').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.fountain`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-slate-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-700 px-6 py-4 text-white">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-amber-400">Feature Screenplay</p>
            <h2 className="text-xl font-semibold">{bookTitle || 'Untitled Screenplay'}</h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-md text-2xl text-slate-300 hover:bg-slate-800 hover:text-white"
            aria-label="Close screenplay"
          >
            ×
          </button>
        </div>

        <div className="overflow-y-auto bg-[#d8d4ca] p-4 sm:p-8">
          <pre className="screenplay-page mx-auto max-w-4xl whitespace-pre-wrap bg-white px-8 py-10 text-[12px] leading-[1.35] text-black shadow-xl sm:px-20 sm:py-14">
            {screenplay}
          </pre>
        </div>

        <div className="flex flex-wrap justify-end gap-3 border-t border-slate-700 bg-slate-950 px-6 py-4">
          <button
            onClick={onRegenerate}
            disabled={isGenerating}
            className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
          >
            {isGenerating ? 'Regenerating...' : 'Regenerate Script'}
          </button>
          <button
            onClick={copyScreenplay}
            className="rounded-md bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-600"
          >
            Copy Fountain
          </button>
          <button
            onClick={downloadScreenplay}
            className="rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400"
          >
            Download .fountain
          </button>
          <button
            onClick={onClose}
            className="rounded-md bg-slate-200 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-white"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';

interface Chapter {
  title: string;
  summary: string;
  details?: string;
}

const LOCAL_STORAGE_KEY = 'storyExpanderProgress';

const StoryExpander: React.FC = () => {
  const [draft, setDraft] = useState<string>('');
  const [useClaude, setUseClaude] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [condensedDraft, setCondensedDraft] = useState<string>('');
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [expandedChapters, setExpandedChapters] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState<number>(0); // 0: idle/summarize, 1: outline, 2: expand
  const [currentChapterIndex, setCurrentChapterIndex] = useState<number>(0);
  const [draftHash, setDraftHash] = useState<string>('');

  // Progress bar: 3 main steps + chapters
  const totalSteps = 3 + (chapters.length || 6); // Estimate 6 if no chapters yet
  const completedSteps = currentStep + (currentStep === 2 ? currentChapterIndex : 0);
  const progressPercent = ((completedSteps / totalSteps) * 100).toFixed(1);

  // Hash draft
  const hashDraft = async (text: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  // Load progress
  useEffect(() => {
    const loadProgress = async () => {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored && draft) {
        const progress = JSON.parse(stored);
        const currentHash = await hashDraft(draft);
        if (progress.draftHash === currentHash) {
          setCondensedDraft(progress.condensedDraft || '');
          setChapters(progress.chapters || []);
          setExpandedChapters(progress.expandedChapters || []);
          setCurrentStep(progress.currentStep || 0);
          setCurrentChapterIndex(progress.currentChapterIndex || 0);
          setStatus('Loaded saved progress—resume or inspect results.');
        } else {
          setStatus('Draft changed—starting fresh.');
        }
      }
    };
    loadProgress();
  }, [draft]);

  // Save progress
  const saveProgress = () => {
    const progress = {
      draftHash,
      condensedDraft,
      chapters,
      expandedChapters,
      currentStep,
      currentChapterIndex,
    };
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(progress));
  };

  // Clear progress
  const clearProgress = () => {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    setCondensedDraft('');
    setChapters([]);
    setExpandedChapters([]);
    setCurrentStep(0);
    setCurrentChapterIndex(0);
    setStatus('Progress cleared—start over.');
  };

  const processStep = async () => {
    setIsLoading(true);
    setError('');
    try {
      if (currentStep === 0) {
        setStatus('Step 1: Summarizing draft chunks...');
        const response = await fetch('/api/summarize-draft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ draft, useClaude }),
        });
        if (!response.ok) throw new Error('Summarize failed');
        const data = await response.json();
        setCondensedDraft(data.condensedDraft);
        setCurrentStep(1);
        setStatus('Step 1 complete: Condensed draft ready (see below).');
        saveProgress();
      } else if (currentStep === 1) {
        setStatus('Step 2: Generating chapter outline...');
        const response = await fetch('/api/generate-outline', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ condensedDraft, useClaude }),
        });
        if (!response.ok) throw new Error('Outline failed');
        const data = await response.json();
        setChapters(data.chapters);
        setExpandedChapters(new Array(data.chapters.length).fill(''));
        setCurrentStep(2);
        setCurrentChapterIndex(0);
        setStatus('Step 2 complete: Outline generated (see below).');
        saveProgress();
      } else if (currentStep === 2 && currentChapterIndex < chapters.length) {
        const chapter = chapters[currentChapterIndex];
        setStatus(`Step 3: Expanding chapter ${currentChapterIndex + 1}/${chapters.length} ("${chapter.title}")...`);
        const response = await fetch('/api/expand-chapter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            condensedDraft,
            title: chapter.title,
            summary: chapter.summary,
            useClaude,
          }),
        });
        if (!response.ok) throw new Error(`Expansion for chapter ${currentChapterIndex + 1} failed`);
        const data = await response.json();
        const newExpanded = [...expandedChapters];
        newExpanded[currentChapterIndex] = data.details;
        setExpandedChapters(newExpanded);
        setCurrentChapterIndex(currentChapterIndex + 1);
        setStatus(`Chapter ${currentChapterIndex + 1} expanded (see below).`);
        saveProgress();
        if (currentChapterIndex + 1 === chapters.length) {
          setStatus('All chapters expanded—full story ready!');
        }
      }
    } catch (err) {
      setError((err as Error).message || 'Step failed—retry this step.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    const newHash = await hashDraft(draft);
    setDraftHash(newHash);
    processStep();
  };

  // Auto-process next step
  useEffect(() => {
    if (isLoading || currentStep < 2 || currentChapterIndex >= chapters.length) return;
    processStep();
  }, [currentChapterIndex]);

  // Full story
  const fullStory = chapters.map((ch, idx) => `### ${ch.title}\n\n${expandedChapters[idx] || '(Pending)'}\n\n---`).join('\n');

  return (
    <div className="space-y-6">
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
          <input type="checkbox" id="useClaude" checked={useClaude} onChange={(e) => setUseClaude(e.target.checked)} className="rounded" />
          <label htmlFor="useClaude" className="text-sm text-gray-600">Use Claude 3.5 (better for long drafts)</label>
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
            onClick={clearProgress}
            className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Clear Progress
          </button>
        </div>
      </form>

      {/* Progress Bar */}
      <div className="bg-gray-200 rounded-full h-4">
        <div className="bg-blue-600 h-4 rounded-full" style={{ width: `${progressPercent}%` }}></div>
      </div>
      <p className="text-sm text-gray-600">Progress: {completedSteps}/{totalSteps} steps ({progressPercent}%)</p>

      {status && <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded">{status}</div>}
      {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">Error: {error}</div>}

      {/* Step 1: Condensed Draft */}
      {condensedDraft && (
        <details className="bg-white p-6 rounded-lg shadow-md">
          <summary className="cursor-pointer font-medium text-blue-600 mb-2">Step 1: Condensed Draft</summary>
          <div className="prose max-w-none text-gray-700">
            <p>{condensedDraft}</p>
          </div>
        </details>
      )}

      {/* Step 2: Chapter Outlines */}
      {chapters.length > 0 && (
        <details className="bg-white p-6 rounded-lg shadow-md">
          <summary className="cursor-pointer font-medium text-blue-600 mb-2">Step 2: Chapter Outlines</summary>
          <ul className="space-y-4 mt-4">
            {chapters.map((chapter, idx) => (
              <li key={idx} className="border-l-4 border-blue-500 pl-4">
                <h3 className="font-semibold text-gray-800">{chapter.title}</h3>
                <p className="text-sm text-gray-600 italic">Summary: {chapter.summary}</p>
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* Step 3: Expanded Chapters */}
      {expandedChapters.some(ch => ch) && (
        <details className="bg-white p-6 rounded-lg shadow-md">
          <summary className="cursor-pointer font-medium text-blue-600 mb-2">Step 3: Expanded Chapters</summary>
          <div className="space-y-6">
            {chapters.map((chapter, idx) => (
              expandedChapters[idx] && (
                <div key={idx} className="border-l-4 border-blue-500 pl-4">
                  <h3 className="font-semibold text-gray-800">{chapter.title}</h3>
                  <p className="text-sm text-gray-600 italic mb-2">Summary: {chapter.summary}</p>
                  <div className="prose max-w-none text-gray-700">
                    <p>{expandedChapters[idx]}</p>
                  </div>
                </div>
              )
            ))}
          </div>
        </details>
      )}

      {/* Final Story */}
      {fullStory && chapters.some((_, idx) => expandedChapters[idx]) && (
        <details className="bg-white p-6 rounded-lg shadow-md">
          <summary className="cursor-pointer font-medium text-blue-600 mb-2">Final Expanded Story</summary>
          <div
            className="prose max-w-none prose-headings:text-lg prose-headings:font-semibold prose-p:leading-relaxed"
            dangerouslySetInnerHTML={{ __html: fullStory.replace(/\n/g, '<br>').replace(/### /g, '<h3>') }}
          />
        </details>
      )}
    </div>
  );
};

export default StoryExpander;

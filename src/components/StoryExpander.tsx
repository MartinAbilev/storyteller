import React, { useState, useEffect, useImperativeHandle, forwardRef, useRef } from 'react';
import { API_KEYS_STORAGE_KEY, type ApiKeys } from './SettingsModal';

// Import types and constants
import {
  LOCAL_STORAGE_KEY,
  PROMPTS_STORAGE_KEY,
  type KeyElements,
  type Chapter,
  MODEL_OPTIONS,
  GLOBAL_IMAGE_STYLE
} from './StoryExpander/constants';

// Import utilities
import {
  chunkText,
  hashDraft,
  imageUrlToBase64,
  getStoredApiKey,
  handleApiError,
  parseJsonResponse
} from './StoryExpander/utils';

// Import API functions
import {
  summarizeDraft,
  generateImage,
  generateImagePrompt,
  refreshImageStyle,
} from './StoryExpander/api';

// Import preview functions
import {
  openChapterPreviewInNewTab,
  openFullBookPreviewInNewTab
} from './StoryExpander/previews';

// Import clipboard utilities
import { copyContentToClipboard } from './StoryExpander/clipboard';
import { useStoryFlowHandlers } from './StoryExpander/useStoryFlowHandlers';
import { useImageHandlers } from './StoryExpander/useImageHandlers';

// Import UI components
import { DraftUploadSection } from './StoryExpander/DraftUploadSection';
import { CondensedDraftSection } from './StoryExpander/CondensedDraftSection';
import { KeyElementsDisplay } from './StoryExpander/KeyElementsDisplay';
import { OutlineSection } from './StoryExpander/OutlineSection';
import { ExpandedChaptersSection } from './StoryExpander/ExpandedChaptersSection';
import { FullStoryDisplay } from './StoryExpander/FullStoryDisplay';
import { ChapterPreviewModal } from './StoryExpander/ChapterPreviewModal';
import { FullBookPreviewModal } from './StoryExpander/FullBookPreviewModal';
import { StatusDisplay } from './StoryExpander/StatusDisplay';

const StoryExpander = forwardRef<{ saveNow: () => void }, {}>((props, ref) => {
  const [draft, setDraft] = useState<string>('');
  const [model, setModel] = useState<string>('gpt-5-mini');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [rawError, setRawError] = useState<string>('');
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [saveStatusType, setSaveStatusType] = useState<'success' | 'error' | null>(null);
  const [saveStatusTimer, setSaveStatusTimer] = useState<number | null>(null);
  const [condensedDraft, setCondensedDraft] = useState<string>('');
  const [keyElements, setKeyElements] = useState<KeyElements | null>(null);
  const [summaryPrompt, setSummaryPrompt] = useState<string>('');
  const [editingSummaryPrompt, setEditingSummaryPrompt] = useState<boolean>(false);
  const [outlinePrompt, setOutlinePrompt] = useState<string>('');
  const [editingOutlinePrompt, setEditingOutlinePrompt] = useState<boolean>(false);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [expandedChapters, setExpandedChapters] = useState<string[]>([]);
  const [expansionCounts, setExpansionCounts] = useState<number[]>([]);
  const [chapterPrompts, setChapterPrompts] = useState<string[]>([]);
  const [editingChapterPrompt, setEditingChapterPrompt] = useState<number | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [currentChapterIndex, setCurrentChapterIndex] = useState<number>(0);
  const [draftHash, setDraftHash] = useState<string>('');
  const [chapterLoading, setChapterLoading] = useState<number | null>(null);
  const [regenerateFromChapterIndex, setRegenerateFromChapterIndex] = useState<number | null>(null);
  const [coverImage, setCoverImage] = useState<string>('');
  const [bookTitle, setBookTitle] = useState<string>('');
  const [coverPrompt, setCoverPrompt] = useState<string>('');
  const [coverGenerationInProgress, setCoverGenerationInProgress] = useState<boolean>(false);
  const [chapterImageLoading, setChapterImageLoading] = useState<number | null>(null);
  const [chapterImagePromptLoading, setChapterImagePromptLoading] = useState<number | null>(null);
  const [previewChapterIndex, setPreviewChapterIndex] = useState<number | null>(null);
  const [isPreviewingFullBook, setIsPreviewingFullBook] = useState<boolean>(false);
  const [globalImageStyle, setGlobalImageStyle] = useState<string>('');
  const [editingImageStyle, setEditingImageStyle] = useState<boolean>(false);
  const [hasInitializedImageStyle, setHasInitializedImageStyle] = useState<boolean>(false);
  const lastGlobalImageStyleRef = useRef<string>('');
  const pendingStyleChangeRef = useRef<boolean>(false);

  // Expose saveNow method via ref
  useImperativeHandle(ref, () => ({
    saveNow: () => {
      saveProgress();
      setSaveStatus('Manually saved');
      setSaveStatusType('success');
      if (saveStatusTimer) {
        window.clearTimeout(saveStatusTimer);
      }
      const t = window.setTimeout(() => setSaveStatus(null), 3000);
      setSaveStatusTimer(t);
    },
  }));

  const totalSteps = 4 + (chapters.length || 6) + expansionCounts.reduce((sum, count) => sum + count, 0);
  const completedSteps = currentStep + (currentStep === 3 ? currentChapterIndex : 0) + expansionCounts.reduce((sum, count) => sum + count, 0);
  const progressPercent = ((completedSteps / totalSteps) * 100).toFixed(1);

  useEffect(() => {
    const loadProgress = async () => {
      // Load saved prompts first so they persist across refresh even without a draft
      try {
        const promptsRaw = localStorage.getItem(PROMPTS_STORAGE_KEY);
        console.log('[Frontend] loadProgress: promptsRaw =', promptsRaw?.substring(0, 100));
        if (promptsRaw) {
          const prompts = JSON.parse(promptsRaw);
          console.log('[Frontend] loadProgress: parsed prompts.globalImageStyle =', prompts.globalImageStyle?.substring(0, 100));
          setSummaryPrompt(prompts.summaryPrompt || '');
          setOutlinePrompt(prompts.outlinePrompt || '');
          setModel(prompts.model || (model || 'gpt-5-mini'));
          // Only set globalImageStyle if it actually exists in storage, don't use default here
          if (prompts.globalImageStyle) {
            lastGlobalImageStyleRef.current = prompts.globalImageStyle;
            setGlobalImageStyle(prompts.globalImageStyle);
            console.log('[Frontend] loadProgress: set globalImageStyle from storage');
          } else {
            console.log('[Frontend] loadProgress: globalImageStyle was empty in storage');
          }
        }
      } catch (err) {
        console.warn('[Frontend] loadProgress: failed to load prompts', err);
      }

      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        try {
          const progress = JSON.parse(stored);
          // restore draft (so textarea is populated) — this avoids requiring the user to paste draft again
          if (progress.draft) setDraft(progress.draft);

          const draftToHash = progress.draft || progress.condensedDraft || '';
          const currentHash = progress.draftHash || (draftToHash ? await hashDraft(draftToHash) : '');

          setCondensedDraft(progress.condensedDraft || '');
          setKeyElements(progress.keyElements || null);
          setSummaryPrompt(progress.summaryPrompt || (summaryPrompt || ''));
          setOutlinePrompt(progress.outlinePrompt || (outlinePrompt || ''));
          setChapters(progress.chapters || []);
          setExpandedChapters(progress.expandedChapters || []);
          setExpansionCounts(progress.expansionCounts || []);
          setChapterPrompts(progress.chapterPrompts || []);
          setCurrentStep(progress.currentStep || 0);
          setCurrentChapterIndex(progress.currentChapterIndex || 0);
          setDraftHash(currentHash);
          setModel(progress.model || model || 'gpt-5-mini');
          setCoverImage(progress.coverImage || '');
          setBookTitle(progress.bookTitle || '');
          if (progress.coverPrompt) {
            setCoverPrompt(progress.coverPrompt);
          }
          if (progress.globalImageStyle) {
            lastGlobalImageStyleRef.current = progress.globalImageStyle;
            setGlobalImageStyle(progress.globalImageStyle);
            console.log('[Frontend] loadProgress: restored globalImageStyle from LOCAL_STORAGE_KEY');
          }
          setStatus('Loaded saved progress—draft and prompts restored.');
        } catch (err) {
          console.warn('[Frontend] loadProgress: failed to parse stored progress', err);
          setStatus('Saved progress corrupted—start fresh.');
        }
      } else {
        setStatus('No saved progress found—start fresh with your draft.');
      }
      // Mark that we've finished initial load
      setHasInitializedImageStyle(true);
    };
    loadProgress();
  }, []);

  // Persist summary/outline prompts (and model) separately so prompts survive Vite refreshes
  useEffect(() => {
    try {
      const toSave: any = { summaryPrompt, outlinePrompt, model };
      // Only save globalImageStyle if it's not empty, to avoid overwriting good values with empty strings on initial mount
      if (globalImageStyle.trim()) {
        toSave.globalImageStyle = globalImageStyle;
      }
      localStorage.setItem(PROMPTS_STORAGE_KEY, JSON.stringify(toSave));
    } catch (err) {
      console.warn('[Frontend] Failed to save prompts to localStorage', err);
    }
  }, [summaryPrompt, outlinePrompt, model, globalImageStyle]);

  const {
    regenerateAllChapterPromptsWithStyle,
    regenerateAllChapterImagesWithStyle,
    handleRefreshImageStyle,
    handleRegenerateChapterImage,
    handleRegenerateChapterImagePrompt,
    handleRegenerateAllImages,
    generateCoverImage,
  } = useImageHandlers({
    draft,
    model,
    condensedDraft,
    globalImageStyle,
    chapters,
    expandedChapters,
    coverImage,
    bookTitle,
    coverPrompt,
    coverGenerationInProgress,
    chapterImageLoading,
    chapterImagePromptLoading,
    keyElements,
    pendingStyleChangeRef,
    saveProgress: (...args) => saveProgress(...args),
    setError,
    setRawError,
    setStatus,
    setChapters,
    setCoverPrompt,
    setCoverImage,
    setBookTitle,
    setGlobalImageStyle,
    setCoverGenerationInProgress,
    setChapterImageLoading,
    setChapterImagePromptLoading,
  });

  // When global image style changes, ask to regenerate all chapter images
  useEffect(() => {
    const askAndRegenerateImages = async () => {
      // Skip regeneration on initial mount (before loadProgress completes)
      if (!hasInitializedImageStyle) {
        return;
      }

      // Only run when the user explicitly saved or refreshed the style
      if (!pendingStyleChangeRef.current) {
        return;
      }

      // Consume the pending change so we only prompt once per save/refresh
      pendingStyleChangeRef.current = false;

      // Don't prompt while the user is typing in the style editor
      if (editingImageStyle) {
        return;
      }

      if (globalImageStyle === lastGlobalImageStyleRef.current) {
        return;
      }

      // Mark this style as handled to avoid repeat prompts on refresh
      lastGlobalImageStyleRef.current = globalImageStyle;

      if (!globalImageStyle.trim() || chapters.length === 0 || expandedChapters.length === 0) {
        return;
      }

      // Only regenerate if there are already expanded chapters with content
      if (!expandedChapters.some(ch => ch && ch.trim())) {
        return;
      }

      const confirmed = window.confirm(
        `Regenerate all ${chapters.length} chapter images with the updated style?\n\nThis may take several minutes.`
      );

      if (!confirmed) {
        console.log('[Frontend] User declined to regenerate chapter images with new style');
        await regenerateAllChapterPromptsWithStyle();
        return;
      }

      await regenerateAllChapterImagesWithStyle();
    };

    askAndRegenerateImages();
  }, [globalImageStyle, hasInitializedImageStyle, editingImageStyle]); // Trigger when style changes or editor closes

  const saveProgress = (
    overrideCoverImage?: string,
    overrideBookTitle?: string,
    overrideCoverPrompt?: string,
    overrideChapters?: Chapter[]
  ) => {
    const progress = {
      draft,
      draftHash,
      condensedDraft,
      keyElements,
      summaryPrompt,
      outlinePrompt,
      chapters: overrideChapters !== undefined ? overrideChapters : chapters,
      expandedChapters,
      expansionCounts,
      chapterPrompts,
      currentStep,
      currentChapterIndex,
      model,
      coverImage: overrideCoverImage !== undefined ? overrideCoverImage : coverImage,
      bookTitle: overrideBookTitle !== undefined ? overrideBookTitle : bookTitle,
      coverPrompt: overrideCoverPrompt !== undefined ? overrideCoverPrompt : coverPrompt,
      globalImageStyle,
    };
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(progress));
    // Also attempt to persist to the backend as story.json (best-effort, non-blocking)
    (async () => {
      try {
        const resp = await fetch('/api/save-state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(progress),
        });
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          console.warn('[Frontend] saveProgress: server save failed', err);
          setSaveStatus('Save failed to server');
          setSaveStatusType('error');
        } else {
          console.log('[Frontend] saveProgress: state saved to server');
          setSaveStatus('Saved to server');
          setSaveStatusType('success');
        }
      } catch (e: any) {
        console.warn('[Frontend] saveProgress: network error', e);
        setSaveStatus('Network error while saving');
        setSaveStatusType('error');
      } finally {
        // clear any existing timer
        if (saveStatusTimer) {
          window.clearTimeout(saveStatusTimer);
        }
        const t = window.setTimeout(() => {
          setSaveStatus(null);
          setSaveStatusType(null);
          setSaveStatusTimer(null);
        }, 4000);
        setSaveStatusTimer(t as unknown as number);
      }
    })();
  };

  const clearProgress = () => {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    setCondensedDraft('');
    setKeyElements(null);
    setSummaryPrompt('');
    setChapters([]);
    setExpandedChapters([]);
    setExpansionCounts([]);
    setChapterPrompts([]);
    setCurrentStep(0);
    setCurrentChapterIndex(0);
    setDraftHash('');
    setCoverImage('');
    setBookTitle('');
    setStatus('Progress cleared—start over.');
    setError('');
    setRawError('');
  };

  const regenerateSummary = async () => {
    if (isLoading) return;
    setIsLoading(true);
    setError('');
    setRawError('');
    setStatus('Regenerating summary with new prompt...');
    try {
      const chunks = chunkText(draft);
      let condensed = '';
      const openaiApiKey = getStoredApiKey();
      for (let i = 0; i < chunks.length; i++) {
        console.log(`[Frontend] Processing chunk ${i + 1}/${chunks.length}`);
        const data = await summarizeDraft({
          draft: chunks[i],
          model,
          chunkIndex: i,
          totalChunks: chunks.length,
          customPrompt: summaryPrompt,
          openaiApiKey,
        });
        condensed += data.condensedChunk + ' ';
      }
      setCondensedDraft(condensed.trim());
      setKeyElements(null);
      setChapters([]);
      setExpandedChapters([]);
      setExpansionCounts([]);
      setChapterPrompts([]);
      setCurrentStep(0);
      setCurrentChapterIndex(0);
      setStatus('Summary regenerated—proceeding to extract key elements.');
      saveProgress();
    } catch (err: any) {
      setError(`Regeneration failed: ${err.message || 'Unknown error'}. Try again.`);
      setRawError(err.rawResponse || '');
    } finally {
      setIsLoading(false);
    }
  };

  const {
    regenerateFromChapterPrompt,
    processStep,
    handleRegenerateOutline,
    handleExpandMore,
    handleRegenerateChapter,
  } = useStoryFlowHandlers({
    isLoading,
    currentStep,
    currentChapterIndex,
    chapterLoading,
    draft,
    condensedDraft,
    summaryPrompt,
    outlinePrompt,
    model,
    globalImageStyle,
    keyElements,
    chapters,
    expandedChapters,
    expansionCounts,
    chapterPrompts,
    setIsLoading,
    setError,
    setRawError,
    setStatus,
    setCondensedDraft,
    setKeyElements,
    setChapters,
    setExpandedChapters,
    setExpansionCounts,
    setChapterPrompts,
    setCurrentStep,
    setCurrentChapterIndex,
    setChapterLoading,
    saveProgress,
    onAllChaptersExpanded: () => generateCoverImage(),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) {
      setError('Draft cannot be empty.');
      return;
    }
    const newHash = await hashDraft(draft);
    setDraftHash(newHash);

    // Generate custom image style from draft if starting fresh
    if (currentStep === 0 && !condensedDraft) {
      setStatus('Analyzing draft to generate custom image style...');
      try {
        const openaiApiKey = getStoredApiKey();
        const styleData = await refreshImageStyle({
          draft: draft.substring(0, 2000),
          model,
          apiKey: openaiApiKey,
        });

        if (styleData.imageStyle) {
          setGlobalImageStyle(styleData.imageStyle);
          console.log('[Frontend] Generated custom image style:', styleData.imageStyle);
        } else {
          console.warn('Failed to generate custom image style, using default');
        }
      } catch (err) {
        console.warn('Error generating image style:', err);
      }

      setStatus('Starting fresh: Summarizing draft...');
      processStep();
    } else {
      setStatus('Resuming from saved progress...');
      processStep();
    }
  };

  const handleContinue = () => {
    if (isLoading) return;
    processStep();
  };

  const handleEditSummaryPrompt = () => {
    setEditingSummaryPrompt(true);
  };

  const handleSaveSummaryPrompt = () => {
    setEditingSummaryPrompt(false);
    if (currentStep > 0 && condensedDraft) {
      setStatus('Summary prompt updated—click "Regenerate Summary" to apply or continue to propagate to outline.');
    }
    saveProgress();
  };

  const handleEditChapterPrompt = (index: number) => {
    setEditingChapterPrompt(index);
  };

  const handleSaveChapterPrompt = (index: number) => {
    setEditingChapterPrompt(null);
    if (expandedChapters[index]) {
      setStatus(`Prompt for chapter ${index + 1} updated—use "Expand More" to apply.`);
    }
    saveProgress();
    // Trigger outline regeneration for subsequent chapters to maintain continuity
    (async () => {
      try {
        await regenerateFromChapterPrompt(index);
      } catch (err: any) {
        console.warn('[Frontend] regenerateFromChapterPrompt failed', err);
      }
    })();
  };

  const handleEditOutlinePrompt = () => {
    setEditingOutlinePrompt(true);
  };

  const handleSaveOutlinePrompt = () => {
    setEditingOutlinePrompt(false);
    if (currentStep > 1 && condensedDraft) {
      setStatus('Outline prompt updated—click "Regenerate Outline" to apply.');
    }
    saveProgress();
  };

  const handleRegenerateExpandedFromChapter = async (fromChapterIndex: number) => {
    if (chapterLoading !== null) return;

    const confirmed = window.confirm(
      `Regenerate expanded chapters starting from Chapter ${fromChapterIndex + 1} ("${chapters[fromChapterIndex]?.title}")?\n\nChapters 1-${fromChapterIndex} will be preserved.\nChapters ${fromChapterIndex + 1}-${chapters.length} will be regenerated.`
    );

    if (!confirmed) return;

    // Clear expansion data for chapters being regenerated, but PRESERVE chapter custom prompts
    const newExpanded = [...expandedChapters];
    const newCounts = [...expansionCounts];
    for (let i = fromChapterIndex; i < chapters.length; i++) {
      newExpanded[i] = '';
      newCounts[i] = 0;
      // NOTE: NOT clearing chapterPrompts[i] - they are preserved for re-expansion
    }

    setExpandedChapters(newExpanded);
    setExpansionCounts(newCounts);
    // NOTE: chapterPrompts are preserved (not cleared)
    setError('');
    setRawError('');
    setStatus(`Regenerating expanded chapters from Chapter ${fromChapterIndex + 1}...`);
    setCurrentChapterIndex(fromChapterIndex);
    setCurrentStep(3);
    saveProgress();
  };

  useEffect(() => {
    console.log(`[Frontend] useEffect triggered: step=${currentStep}, chapterIndex=${currentChapterIndex}, chapters=${chapters.length}, loading=${isLoading}`);
    if (isLoading || (currentStep === 3 && currentChapterIndex >= chapters.length)) return;
    if (currentStep > 0 || condensedDraft) {
      processStep();
    }
  }, [currentStep, currentChapterIndex, chapters.length, condensedDraft]);

  const fullStory = chapters.map((ch, idx) => `### ${ch.title}\n\n${expandedChapters[idx] || '(Pending)'}\n\n---`).join('\n');

  // Auto-generate cover image when all chapters are complete
  useEffect(() => {
    if (chapters.length > 0 &&
        expandedChapters.every(ch => ch) &&
        !coverImage &&
        !coverGenerationInProgress &&
        currentStep === 3 &&
        currentChapterIndex >= chapters.length) {
      generateCoverImage();
    }
  }, [chapters.length, expandedChapters, coverImage, coverGenerationInProgress, currentStep, currentChapterIndex]);

  // Wrapper for chapter preview with local state
  const handleOpenChapterPreview = async (idx: number) => {
    await openChapterPreviewInNewTab(idx, chapters[idx], expandedChapters[idx], (msg) => setError(msg));
  };

  // Wrapper for full book preview with local state
  const handleOpenFullBookPreview = async () => {
    await openFullBookPreviewInNewTab(chapters, expandedChapters, bookTitle, coverImage, setError, setStatus);
  };

  // Wrapper for copy with local state
  const handleCopyWithImages = async (htmlContent: string, imageUrls: string[]) => {
    await copyContentToClipboard(htmlContent, imageUrls, setStatus, setError);
  };

  return (
    <div className="space-y-6">
      <DraftUploadSection
        draft={draft}
        setDraft={setDraft}
        model={model}
        setModel={setModel}
        globalImageStyle={globalImageStyle}
        setGlobalImageStyle={setGlobalImageStyle}
        editingImageStyle={editingImageStyle}
        setEditingImageStyle={setEditingImageStyle}
        isLoading={isLoading}
        currentStep={currentStep}
        handleSubmit={handleSubmit}
        handleContinue={handleContinue}
        clearProgress={clearProgress}
        handleRefreshImageStyle={handleRefreshImageStyle}
        pendingStyleChangeRef={pendingStyleChangeRef}
        saveProgress={saveProgress}
      />

      <StatusDisplay
        progressPercent={progressPercent}
        completedSteps={completedSteps}
        totalSteps={totalSteps}
        status={status}
        error={error}
        rawError={rawError}
        saveStatus={saveStatus}
        saveStatusType={saveStatusType}
      />

      <CondensedDraftSection
        condensedDraft={condensedDraft}
        currentStep={currentStep}
        editingSummaryPrompt={editingSummaryPrompt}
        summaryPrompt={summaryPrompt}
        setSummaryPrompt={setSummaryPrompt}
        setEditingSummaryPrompt={setEditingSummaryPrompt}
        isLoading={isLoading}
        handleEditSummaryPrompt={handleEditSummaryPrompt}
        handleSaveSummaryPrompt={handleSaveSummaryPrompt}
        regenerateSummary={regenerateSummary}
      />

      <KeyElementsDisplay
        keyElements={keyElements}
        currentStep={currentStep}
      />

      <OutlineSection
        chapters={chapters}
        currentStep={currentStep}
        editingOutlinePrompt={editingOutlinePrompt}
        outlinePrompt={outlinePrompt}
        summaryPrompt={summaryPrompt}
        setOutlinePrompt={setOutlinePrompt}
        setEditingOutlinePrompt={setEditingOutlinePrompt}
        editingChapterPrompt={editingChapterPrompt}
        chapterPrompts={chapterPrompts}
        setChapterPrompts={setChapterPrompts}
        setEditingChapterPrompt={setEditingChapterPrompt}
        isLoading={isLoading}
        handleEditOutlinePrompt={handleEditOutlinePrompt}
        handleSaveOutlinePrompt={handleSaveOutlinePrompt}
        handleRegenerateOutline={handleRegenerateOutline}
        handleEditChapterPrompt={handleEditChapterPrompt}
        handleSaveChapterPrompt={handleSaveChapterPrompt}
      />

      <ExpandedChaptersSection
        chapters={chapters}
        expandedChapters={expandedChapters}
        expansionCounts={expansionCounts}
        chapterPrompts={chapterPrompts}
        currentStep={currentStep}
        editingChapterPrompt={editingChapterPrompt}
        chapterLoading={chapterLoading}
        chapterImageLoading={chapterImageLoading}
        chapterImagePromptLoading={chapterImagePromptLoading}
        setChapterPrompts={setChapterPrompts}
        setEditingChapterPrompt={setEditingChapterPrompt}
        handleEditChapterPrompt={handleEditChapterPrompt}
        handleSaveChapterPrompt={handleSaveChapterPrompt}
        handleExpandMore={handleExpandMore}
        handleRegenerateChapter={handleRegenerateChapter}
        handleRegenerateExpandedFromChapter={handleRegenerateExpandedFromChapter}
        handleRegenerateChapterImage={handleRegenerateChapterImage}
        handleRegenerateChapterImagePrompt={handleRegenerateChapterImagePrompt}
        setPreviewChapterIndex={setPreviewChapterIndex}
      />

      <FullStoryDisplay
        fullStory={fullStory}
        chapters={chapters}
        expandedChapters={expandedChapters}
        currentStep={currentStep}
        currentChapterIndex={currentChapterIndex}
        bookTitle={bookTitle}
        coverImage={coverImage}
        coverGenerationInProgress={coverGenerationInProgress}
        chapterImageLoading={chapterImageLoading}
        setCoverGenerationInProgress={setCoverGenerationInProgress}
        setCoverImage={setCoverImage}
        setIsPreviewingFullBook={setIsPreviewingFullBook}
        setPreviewChapterIndex={setPreviewChapterIndex}
        generateCoverImage={generateCoverImage}
        handleRegenerateAllImages={handleRegenerateAllImages}
        handleRegenerateChapterImage={handleRegenerateChapterImage}
        handleRegenerateChapterImagePrompt={handleRegenerateChapterImagePrompt}
        handleCopyWithImages={handleCopyWithImages}
      />

      <ChapterPreviewModal
        previewChapterIndex={previewChapterIndex}
        chapters={chapters}
        expandedChapters={expandedChapters}
        setPreviewChapterIndex={setPreviewChapterIndex}
        handleCopyWithImages={handleCopyWithImages}
        handleOpenChapterPreview={handleOpenChapterPreview}
      />

      <FullBookPreviewModal
        isPreviewingFullBook={isPreviewingFullBook}
        chapters={chapters}
        expandedChapters={expandedChapters}
        bookTitle={bookTitle}
        coverImage={coverImage}
        setIsPreviewingFullBook={setIsPreviewingFullBook}
        handleCopyWithImages={handleCopyWithImages}
        handleOpenFullBookPreview={handleOpenFullBookPreview}
      />
    </div>
  );
});

StoryExpander.displayName = 'StoryExpander';

export default StoryExpander;

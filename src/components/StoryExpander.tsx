import React, { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { API_KEYS_STORAGE_KEY, type ApiKeys } from './SettingsModal';

interface Character {
  name: string;
  gender: string;
  role: string;
  traits: string;
  affiliations?: string;
}

interface KeyElements {
  characters: Character[];
  keyEvents: string[];
  timeline: string[];
  uniqueDetails: string[];
  mainStoryLines: string[];
}

interface Chapter {
  title: string;
  summary: string;
  keyEvents?: string[];
  characterTraits?: string[];
  timeline?: string;
  expansionCount?: number;
  customPrompt?: string;
  imagePrompt?: string;
  imageUrl?: string;
}

const LOCAL_STORAGE_KEY = 'storyExpanderProgress';
const PROMPTS_STORAGE_KEY = 'storyExpanderPrompts';

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
  const [coverGenerationInProgress, setCoverGenerationInProgress] = useState<boolean>(false);
  const [chapterImageLoading, setChapterImageLoading] = useState<number | null>(null);
  const [chapterImagePromptLoading, setChapterImagePromptLoading] = useState<number | null>(null);
  const [previewChapterIndex, setPreviewChapterIndex] = useState<number | null>(null);
  const [isPreviewingFullBook, setIsPreviewingFullBook] = useState<boolean>(false);
  const [globalImageStyle, setGlobalImageStyle] = useState<string>('');
  const [editingImageStyle, setEditingImageStyle] = useState<boolean>(false);
  const [hasInitializedImageStyle, setHasInitializedImageStyle] = useState<boolean>(false);

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

  // Helper function to get stored API key
  const getStoredApiKey = (): string => {
    try {
      const stored = localStorage.getItem(API_KEYS_STORAGE_KEY);
      if (stored) {
        const keys = JSON.parse(stored) as ApiKeys;
        return keys.openai || '';
      }
    } catch (e) {
      console.error('Failed to get stored API key:', e);
    }
    return '';
  };

  // Helper function to handle API errors
  const handleApiError = (error: any, response?: Response): Error => {
    if (response?.status === 401) {
      return new Error(
        error?.error ||
        'API key not found. Add your key in Settings (⚙️) or use OPENAI_API_KEY in .env. Settings take priority.'
      );
    }
    return error || new Error('Unknown error');
  };

  // Helper function to safely parse JSON responses
  const parseJsonResponse = async (response: Response, context: string): Promise<any> => {
    try {
      const text = await response.text();
      if (!text) {
        throw new Error('Empty response body');
      }
      return JSON.parse(text);
    } catch (jsonError: any) {
      console.error(`[Frontend] Failed to parse JSON in ${context}:`, jsonError);
      console.error(`[Frontend] Response status: ${response.status}`);
      throw new Error(`Server error in ${context}: ${jsonError.message || 'Invalid response format'}`);
    }
  };

  const modelOptions = [
    { value: 'gpt-4o-mini', label: 'GPT-4o-mini (Fast & Cheap)' },
    { value: 'gpt-4o', label: 'GPT-4o (Balanced)' },
    { value: 'gpt-5-mini', label: 'GPT-5-mini (Efficient) - Default' },
    { value: 'gpt-5', label: 'GPT-5 (PhD-Level, Powerful)' },
  ];

  const totalSteps = 4 + (chapters.length || 6) + expansionCounts.reduce((sum, count) => sum + count, 0);
  const completedSteps = currentStep + (currentStep === 3 ? currentChapterIndex : 0) + expansionCounts.reduce((sum, count) => sum + count, 0);
  const progressPercent = ((completedSteps / totalSteps) * 100).toFixed(1);

  const chunkText = (text: string, maxBytes = 50000): string[] => {
    const encoder = new TextEncoder();
    const chunks: string[] = [];
    let currentChunk = '';
    let currentBytes = 0;
    const sentences = text.match(/[^.!?]+[.!?]+/gs) || [text];
    console.log(`[Frontend] chunkText: Processing ${sentences.length} sentences`);
    for (const sentence of sentences) {
      const sentenceBytes = encoder.encode(sentence).length;
      if (currentBytes + sentenceBytes > maxBytes) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          console.log(`[Frontend] chunkText: Created chunk ${chunks.length} (~${encoder.encode(currentChunk).length} bytes)`);
        }
        currentChunk = sentence;
        currentBytes = sentenceBytes;
      } else {
        currentChunk += ' ' + sentence;
        currentBytes += sentenceBytes;
      }
    }
    if (currentChunk) {
      chunks.push(currentChunk.trim());
      console.log(`[Frontend] chunkText: Created final chunk ${chunks.length} (~${encoder.encode(currentChunk).length} bytes)`);
    }
    console.log(`[Frontend] chunkText: Generated ${chunks.length} chunks`);
    return chunks;
  };

  const hashDraft = async (text: string): Promise<string> => {
    if (!text) return '';
    try {
      const isSecureContext = window.isSecureContext || (window.location.hostname === 'localhost' || window.location.protocol === 'https:');
      console.log(`[Frontend] hashDraft: Running in secure context: ${isSecureContext}, hostname: ${window.location.hostname}, protocol: ${window.location.protocol}`);

      if (!window.crypto?.subtle) {
        console.warn('[Frontend] hashDraft: Web Crypto API (crypto.subtle) unavailable, using fallback hash');
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
          const char = text.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash = hash & hash;
        }
        return Math.abs(hash).toString(16).padStart(8, '0');
      }

      const encoder = new TextEncoder();
      const data = encoder.encode(text);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (error: any) {
      console.error(`[Frontend] hashDraft error: ${error.message || error}`);
      let hash = 0;
      for (let i = 0; i < text.length; i++) {
        const char = text.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return Math.abs(hash).toString(16).padStart(8, '0');
    }
  };

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
          if (progress.globalImageStyle) {
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

  // Helper function to regenerate all chapter images with current global style
  const regenerateAllChapterImagesWithStyle = async () => {
    if (!globalImageStyle.trim() || chapters.length === 0 || expandedChapters.length === 0) {
      return;
    }

    // Only regenerate if there are already expanded chapters with content
    if (!expandedChapters.some(ch => ch && ch.trim())) {
      return;
    }

    console.log('[Frontend] Regenerating chapter image prompts and images with current style...');

    const openaiApiKey = getStoredApiKey();
    let updatedChapters = [...chapters];
    let successCount = 0;
    let failureCount = 0;

    for (let idx = 0; idx < updatedChapters.length; idx++) {
      const chapter = updatedChapters[idx];
      const chapterText = expandedChapters[idx];

      if (!chapterText || !chapterText.trim()) {
        continue;
      }

      try {
        setChapterImagePromptLoading(idx);

        // Regenerate image prompt with new global style
        const imagePromptResponse = await fetch('/api/generate-image-prompt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: chapter.title,
            summary: chapter.summary,
            chapterText: chapterText,
            model,
            apiKey: openaiApiKey,
            globalImageStyle,
          }),
        });

        if (!imagePromptResponse.ok) {
          failureCount++;
          continue;
        }

        const imagePromptData = await parseJsonResponse(imagePromptResponse, 'generate-image-prompt');
        const newImagePrompt = imagePromptData.imagePrompt;

        if (!newImagePrompt || !newImagePrompt.trim()) {
          failureCount++;
          continue;
        }

        // Update chapter with new image prompt
        updatedChapters[idx] = {
          ...updatedChapters[idx],
          imagePrompt: newImagePrompt,
        };

        // Regenerate image with new prompt and global style
        const imageResponse = await fetch('/api/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imagePrompt: newImagePrompt,
            apiKey: openaiApiKey,
            title: chapter.title,
            summary: chapter.summary,
            imageType: 'chapter',
            globalImageStyle,
          }),
        });

        if (!imageResponse.ok) {
          failureCount++;
          continue;
        }

        const imageData = await parseJsonResponse(imageResponse, 'generate-image');
        const imageUrl = imageData.imageUrl || '';

        if (!imageUrl) {
          failureCount++;
          continue;
        }

        updatedChapters[idx] = {
          ...updatedChapters[idx],
          imageUrl,
        };
        successCount++;

        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (err: any) {
        console.error(`Chapter ${idx + 1} image regeneration failed:`, err);
        failureCount++;
      } finally {
        setChapterImagePromptLoading(null);
      }
    }

    // Update state once with all changes
    setChapters(updatedChapters);
    setStatus(`Images updated with new style! ${successCount} chapter images regenerated${failureCount > 0 ? `, ${failureCount} failed` : ''}.`);

    // Save with updated data
    saveProgress();
  };

  // When global image style changes, ask to regenerate all chapter images
  useEffect(() => {
    const askAndRegenerateImages = async () => {
      // Skip regeneration on initial mount (before loadProgress completes)
      if (!hasInitializedImageStyle) {
        return;
      }

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
        return;
      }

      await regenerateAllChapterImagesWithStyle();
    };

    askAndRegenerateImages();
  }, [globalImageStyle, hasInitializedImageStyle]); // Only trigger when globalImageStyle changes (after initial load)

  const saveProgress = (overrideCoverImage?: string, overrideBookTitle?: string) => {
    const progress = {
      draft,
      draftHash,
      condensedDraft,
      keyElements,
      summaryPrompt,
      outlinePrompt,
      chapters,
      expandedChapters,
      expansionCounts,
      chapterPrompts,
      currentStep,
      currentChapterIndex,
      model,
      coverImage: overrideCoverImage !== undefined ? overrideCoverImage : coverImage,
      bookTitle: overrideBookTitle !== undefined ? overrideBookTitle : bookTitle,
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
      let condensedDraft = '';
      const openaiApiKey = getStoredApiKey();
      for (let i = 0; i < chunks.length; i++) {
        console.log(`[Frontend] Processing chunk ${i + 1}/${chunks.length}`);
        const response = await fetch('/api/summarize-draft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ draft: chunks[i], model, customPrompt: summaryPrompt, chunkIndex: i, totalChunks: chunks.length, openaiApiKey }),
        });
        if (!response.ok) {
          const errData = await parseJsonResponse(response, 'summarize-draft error');
          throw handleApiError(errData, response);
        }
        const data = await parseJsonResponse(response, 'summarize-draft');
        condensedDraft += data.condensedChunk + ' ';
      }
      setCondensedDraft(condensedDraft.trim());
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

  // Regenerate outline from a given chapter index onward when a chapter-level prompt changes
  const regenerateFromChapterPrompt = async (chapterIndex: number, options?: { force?: boolean }) => {
    if (isLoading && !options?.force) return;
    if (!condensedDraft) {
      setError('Cannot regenerate outline: condensed draft is empty.');
      return;
    }
    if (!keyElements) {
      setError('Cannot regenerate outline: key elements missing. Run Step 2 first.');
      return;
    }

    setIsLoading(true);
    setError('');
    setRawError('');
    setStatus(`Regenerating outline from chapter ${chapterIndex + 1} onward...`);

    try {
      const existingOutline = chapters.map((ch) => ({ title: ch.title, summary: ch.summary, keyEvents: ch.keyEvents || [], characterTraits: ch.characterTraits || [], timeline: ch.timeline || '' }));
      const chapterPrompt = chapterPrompts[chapterIndex] || '';

      // Build a previous-chapters context block including summaries and any expanded chapter text
      const prevChapters = chapters.slice(0, chapterIndex).map((ch, idx) => ({
        index: idx + 1,
        title: ch.title,
        summary: ch.summary,
        expanded: expandedChapters[idx] || '',
        customPrompt: chapterPrompts[idx] || ''
      }));
      const previousContext = prevChapters.length > 0 ? prevChapters.map(pc => {
        const parts = [`Chapter ${pc.index}: ${pc.title}`, `Summary: ${pc.summary}`];
        if (pc.customPrompt) parts.push(`CustomPrompt: ${pc.customPrompt}`);
        if (pc.expanded) parts.push(`ExpandedText: ${pc.expanded.substring(0, 2000)}`);
        return parts.join('\n');
      }).join('\n\n') : '';

      const instruction = `Preserve the first ${chapterIndex} chapters exactly as provided in the existing outline. Apply the custom prompt for chapter ${chapterIndex + 1}: "${chapterPrompt}". Then REWRITE chapters ${chapterIndex + 1} through the end so they flow logically from the updated chapter ${chapterIndex + 1} — change titles, summaries, key events, character focus, and timelines as needed to maintain coherent arcs. Do NOT preserve the old content of chapters ${chapterIndex + 1}..end; regenerate them fully (they may be substantially different). Keep the total number of chapters the same, and ensure chapter ordering and timeline progression remain clear.

CRITICAL - Narrative Continuity: Use the previous chapters' summaries and expanded content (provided) as continuing context when creating later chapters. Most importantly:
- Any major plot elements, antagonists, characters, conflicts, or story developments introduced in previous chapters (especially those with custom prompts) MUST be acknowledged and continued in subsequent chapters
- Chapters following a chapter with a custom prompt MUST show how that narrative change affects the broader story arc
- Do NOT introduce new plot elements and then abandon them in the next chapter — ensure introduced elements either drive multiple chapters forward or have explicit narrative resolution
- Each chapter should reference or address the consequences of earlier narrative decisions

Output strictly JSON: an array of chapter objects with fields { "title", "summary", "keyEvents", "characterTraits", "timeline" } and no Markdown or code fences. Provide varied, non-repetitive openings and ensure each chapter advances the plot.`;

      const customPrompt = `${instruction}\n\nPrevious Chapters Context (titles, summaries, custom prompts, and truncated expanded text):\n${previousContext}\n\nExisting outline: ${JSON.stringify(existingOutline)}\nAdditional outline instructions (if any): ${outlinePrompt || summaryPrompt || ''}`;

      // First, call the extract-key-elements endpoint to augment keyElements with
      // any major new elements introduced in previousContext or the chapter prompt
      // (e.g., Orks introduced via a custom prompt that must persist).
      let augmentedKeyElements = keyElements;
      const openaiApiKey = getStoredApiKey();
      try {
        const extractPrompt = `Please update and augment the story's key elements based on the following previous chapter context and any custom prompts.\n\nContext:\n${previousContext}\n\nExisting key elements (base): ${JSON.stringify(keyElements)}\n\nAdditional instructions: If the context introduces new characters, factions, recurring antagonists, or major plot threads (for example 'Orks' arriving), include them as persistent key elements so they continue to appear across later chapters. Output a JSON object { characters: [...], keyEvents: [...], timeline: [...], uniqueDetails: [...], mainStoryLines: [...] } with no Markdown or extra text.`;
        const extractResp = await fetch('/api/extract-key-elements', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ condensedDraft, model, customPrompt: extractPrompt, openaiApiKey }),
        });
        if (extractResp.ok) {
          const extractData = await parseJsonResponse(extractResp, 'augment-key-elements');
          const newKE = extractData.keyElements;
          if (newKE) {
            // merge characters by name, keyEvents/timeline/uniqueDetails/mainStoryLines by uniqueness
            const mergeUnique = (a: any[] = [], b: any[] = []) => {
              const set = new Set(a.map(x => JSON.stringify(x)));
              b.forEach(x => set.add(JSON.stringify(x)));
              return Array.from(set).map(s => JSON.parse(s));
            };
            const mergedCharacters = (() => {
              const map = new Map<string, any>();
              (keyElements.characters || []).forEach((c: any) => map.set((c.name || c).toString(), c));
              (newKE.characters || []).forEach((c: any) => {
                const name = (c.name || c).toString();
                if (!map.has(name)) map.set(name, c);
              });
              return Array.from(map.values());
            })();

            augmentedKeyElements = {
              characters: mergedCharacters,
              keyEvents: mergeUnique(keyElements.keyEvents || [], newKE.keyEvents || []),
              timeline: mergeUnique(keyElements.timeline || [], newKE.timeline || []),
              uniqueDetails: mergeUnique(keyElements.uniqueDetails || [], newKE.uniqueDetails || []),
              mainStoryLines: mergeUnique(keyElements.mainStoryLines || [], newKE.mainStoryLines || []),
            };
          }
        } else {
          const errData = await parseJsonResponse(extractResp, 'augment-key-elements error');
          console.warn('[Frontend] augment keyElements: extract endpoint failed:', errData.error || 'Unknown error');
        }
      } catch (e) {
        console.warn('[Frontend] augment keyElements failed', e);
      }

      // Now call generate-outline using the augmented key elements so introduced
      // entities (like Orks) are preserved and considered when regenerating later chapters.
      const response = await fetch('/api/generate-outline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ condensedDraft, model, customPrompt, keyElements: augmentedKeyElements, openaiApiKey }),
      });
      if (!response.ok) {
        const errData = await response.json();
        const error = handleApiError(errData, response);
        throw Object.assign(error, { rawResponse: errData.rawResponse || '' });
      }
      const data = await response.json();
      const validatedChapters = data.chapters.map((ch: Chapter) => ({
        title: ch.title || 'Untitled Chapter',
        summary: ch.summary || 'No summary available.',
        keyEvents: Array.isArray(ch.keyEvents) ? ch.keyEvents : [],
        characterTraits: Array.isArray(ch.characterTraits) ? ch.characterTraits : [],
        timeline: ch.timeline || 'Unknown timeline',
      }));

      const newLen = validatedChapters.length;
      const newExpanded = new Array(newLen).fill('');
      const newCounts = new Array(newLen).fill(0);
      const newPrompts = new Array(newLen).fill('');

      for (let i = 0; i < newLen; i++) {
        if (i < chapterIndex) {
          // preserve earlier chapters' expansions/counts/prompts
          newExpanded[i] = expandedChapters[i] || '';
          newCounts[i] = expansionCounts[i] || 0;
          newPrompts[i] = chapterPrompts[i] || '';
        } else {
          // for regenerated and later chapters, try to preserve any existing custom prompt mapping
          newPrompts[i] = chapterPrompts[i] || '';
        }
      }

      setChapters(validatedChapters);
      setExpandedChapters(newExpanded);
      setExpansionCounts(newCounts);
      setChapterPrompts(newPrompts);
      setCurrentStep(3);
      setCurrentChapterIndex((idx) => Math.min(idx, validatedChapters.length));
      setStatus('Outline regenerated from the edited chapter onward.');
      saveProgress();
    } catch (err: any) {
      setError(`Outline regeneration failed: ${err.message || 'Unknown error'}`);
      setRawError(err.rawResponse || '');
    } finally {
      setIsLoading(false);
    }
  };

  const processStep = async () => {
    setIsLoading(true);
    setError('');
    setRawError('');
    try {
      if (currentStep === 0) {
        setStatus('Step 1: Summarizing draft chunks...');
        const chunks = chunkText(draft);
        let condensedDraft = '';
        const openaiApiKey = getStoredApiKey();
        for (let i = 0; i < chunks.length; i++) {
          console.log(`[Frontend] Processing chunk ${i + 1}/${chunks.length}`);
          const response = await fetch('/api/summarize-draft', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ draft: chunks[i], model, customPrompt: summaryPrompt, chunkIndex: i, totalChunks: chunks.length, openaiApiKey }),
          });
          if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || `Summarization failed for chunk ${i + 1}`);
          }
          const data = await response.json();
          condensedDraft += data.condensedChunk + ' ';
        }
        setCondensedDraft(condensedDraft.trim());
        setCurrentStep(1);
        setStatus('Step 1 complete: Condensed draft ready (see below).');
        saveProgress();
      } else if (currentStep === 1) {
        setStatus('Step 2: Extracting key elements...');
        const openaiApiKey = getStoredApiKey();
        const response = await fetch('/api/extract-key-elements', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ condensedDraft, model, customPrompt: summaryPrompt, openaiApiKey }),
        });
        if (!response.ok) {
          const errData = await response.json();
          const error = handleApiError(errData, response);
          throw Object.assign(error, { rawResponse: errData.rawResponse || '' });
        }
        const data = await response.json();
        setKeyElements(data.keyElements);
        setCurrentStep(2);
        setStatus('Step 2 complete: Key elements extracted (see below).');
        saveProgress();
      } else if (currentStep === 2) {
        setStatus('Step 3: Generating chapter outline...');
        // Ensure all chapter metadata fields are regenerated holistically with custom prompt
        const enhancedSummaryPrompt = summaryPrompt ? `${summaryPrompt}

CRITICAL: When applying the above instructions, you MUST regenerate ALL chapter metadata fields:
- Update summaries to reflect the custom prompt modifications
- Regenerate keyEvents to align with and support the updated summaries
- Regenerate characterTraits to match the character roles and developments in the updated summaries
- Update timeline if the custom prompt affects temporal pacing

All four fields must be coherent and internally consistent.` : '';

        const openaiApiKey = getStoredApiKey();
        const response = await fetch('/api/generate-outline', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ condensedDraft, model, customPrompt: enhancedSummaryPrompt, keyElements, openaiApiKey }),
        });
        if (!response.ok) {
          const errData = await response.json();
          const error = handleApiError(errData, response);
          throw Object.assign(error, { rawResponse: errData.rawResponse || '' });
        }
        const data = await response.json();
        const validatedChapters = data.chapters.map((ch: Chapter) => ({
          title: ch.title || 'Untitled Chapter',
          summary: ch.summary || 'No summary available.',
          keyEvents: Array.isArray(ch.keyEvents) ? ch.keyEvents : [],
          characterTraits: Array.isArray(ch.characterTraits) ? ch.characterTraits : [],
          timeline: ch.timeline || 'Unknown timeline',
        }));
        setChapters(validatedChapters);
        setExpandedChapters(new Array(validatedChapters.length).fill(''));
        setExpansionCounts(new Array(validatedChapters.length).fill(0));
        setChapterPrompts(new Array(validatedChapters.length).fill(''));
        setCurrentStep(3);
        setCurrentChapterIndex(0);
        setStatus('Step 3 complete: Outline generated (see below).');
        saveProgress();
      } else if (currentStep === 3 && currentChapterIndex < chapters.length) {
        const chapter = chapters[currentChapterIndex];
        const customPrompt = chapterPrompts[currentChapterIndex] || '';
        const openaiApiKey = getStoredApiKey();
        setStatus(`Step 4: Expanding chapter ${currentChapterIndex + 1}/${chapters.length} ("${chapter.title}")...`);
        setChapterLoading(currentChapterIndex);
        const response = await fetch('/api/expand-chapter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            condensedDraft,
            title: chapter.title,
            summary: chapter.summary,
            keyEvents: chapter.keyEvents || [],
            characterTraits: chapter.characterTraits || [],
            timeline: chapter.timeline || 'Unknown timeline',
            model,
            customPrompt,
            chapterIndex: currentChapterIndex,
            previousChapters: chapters.slice(0, currentChapterIndex),
            totalChapters: chapters.length,
            keyElements,
            openaiApiKey,
          }),
        });
        if (!response.ok) {
          const errData = await parseJsonResponse(response, 'expand-chapter error');
          throw handleApiError(errData, response) || new Error(`Expansion for chapter ${currentChapterIndex + 1} failed`);
        }
        const data = await parseJsonResponse(response, 'expand-chapter');
        const newExpanded = [...expandedChapters];
        newExpanded[currentChapterIndex] = data.details;
        setExpandedChapters(newExpanded);

        // Generate image prompt for the chapter
        setStatus(`Generating image prompt for chapter ${currentChapterIndex + 1}...`);
        const imagePromptResponse = await fetch('/api/generate-image-prompt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: chapter.title,
            summary: chapter.summary,
            chapterText: data.details,
            model,
            apiKey: openaiApiKey,
            globalImageStyle,
          }),
        });

        let imagePrompt = '';
        let imageUrl = '';

        if (imagePromptResponse.ok) {
          const imagePromptData = await parseJsonResponse(imagePromptResponse, 'generate-image-prompt');
          imagePrompt = imagePromptData.imagePrompt;

          // Generate image using DALL-E 3
          setStatus(`Generating image for chapter ${currentChapterIndex + 1}...`);
          const imageResponse = await fetch('/api/generate-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imagePrompt,
              apiKey: openaiApiKey,
              title: chapter.title,
              summary: chapter.summary,
              imageType: 'chapter',
              globalImageStyle,
            }),
          });

          if (imageResponse.ok) {
            const imageData = await parseJsonResponse(imageResponse, 'generate-image');
            imageUrl = imageData.imageUrl || '';
            if (!imageUrl && imageData.error) {
              console.warn(`Image generation: ${imageData.error}`);
            }
          } else {
            console.warn(`Failed to generate image for chapter ${currentChapterIndex + 1}`);
          }
        } else {
          console.warn(`Failed to generate image prompt for chapter ${currentChapterIndex + 1}`);
        }

        // Update chapter with image prompt and URL
        const newChapters = [...chapters];
        newChapters[currentChapterIndex] = {
          ...newChapters[currentChapterIndex],
          imagePrompt,
          imageUrl,
        };
        setChapters(newChapters);

        setCurrentChapterIndex(currentChapterIndex + 1);
        setStatus(`Chapter ${currentChapterIndex + 1} expanded (see below).`);
        saveProgress();
        if (currentChapterIndex + 1 === chapters.length) {
          setStatus('All chapters expanded—full story ready!');
          // Generate cover image after all chapters are done
          setTimeout(() => generateCoverImage(), 1000);
        }
      }
    } catch (err: any) {
      setError(`Step failed: ${err.message || 'Unknown error'}. Click Continue to retry.`);
      setRawError(err.rawResponse || '');
    } finally {
      setIsLoading(false);
      setChapterLoading(null);
    }
  };

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
        const styleResponse = await fetch('/api/generate-image-style', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            draft: draft.substring(0, 2000),
            model,
            apiKey: openaiApiKey,
          }),
        });

        if (styleResponse.ok) {
          const styleData = await parseJsonResponse(styleResponse, 'generate-image-style');
          if (styleData.imageStyle) {
            setGlobalImageStyle(styleData.imageStyle);
            console.log('[Frontend] Generated custom image style:', styleData.imageStyle);
          }
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

  const handleRefreshImageStyle = async () => {
    if (!draft.trim()) {
      setError('Please paste a draft first.');
      return;
    }

    setStatus('Refreshing image style from draft...');
    setError('');
    try {
      const openaiApiKey = getStoredApiKey();
      const styleResponse = await fetch('/api/generate-image-style', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draft: draft.substring(0, 2000),
          model,
          apiKey: openaiApiKey,
        }),
      });

      if (styleResponse.ok) {
        const styleData = await parseJsonResponse(styleResponse, 'generate-image-style');
        if (styleData.imageStyle) {
          setGlobalImageStyle(styleData.imageStyle);
          setStatus('Image style refreshed!');
          console.log('[Frontend] Refreshed image style:', styleData.imageStyle);
          // Directly save the refreshed style to localStorage to avoid async state issues
          try {
            const promptsRaw = localStorage.getItem(PROMPTS_STORAGE_KEY) || '{}';
            const prompts = JSON.parse(promptsRaw);
            prompts.globalImageStyle = styleData.imageStyle;
            localStorage.setItem(PROMPTS_STORAGE_KEY, JSON.stringify(prompts));
            console.log('[Frontend] Saved refreshed style to PROMPTS_STORAGE_KEY');
          } catch (e) {
            console.warn('[Frontend] Failed to save refreshed style:', e);
          }
        }
      } else {
        setError('Failed to refresh image style');
      }
    } catch (err) {
      setError(`Error refreshing image style: ${err}`);
      console.warn('Error refreshing image style:', err);
    }
  };

  const handleExpandMore = async (chapterIndex: number) => {
    if (chapterLoading !== null) return;
    setChapterLoading(chapterIndex);
    setError('');
    setRawError('');
    try {
      const chapter = chapters[chapterIndex];
      const customPrompt = chapterPrompts[chapterIndex] || '';
      const openaiApiKey = getStoredApiKey();
      setStatus(`Expanding chapter ${chapterIndex + 1} ("${chapter.title}") further...`);
      const response = await fetch('/api/expand-chapter-more', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          condensedDraft,
          title: chapter.title,
          summary: chapter.summary,
          keyEvents: chapter.keyEvents || [],
          characterTraits: chapter.characterTraits || [],
          timeline: chapter.timeline || 'Unknown timeline',
          existingDetails: expandedChapters[chapterIndex],
          model,
          customPrompt,
          chapterIndex,
          previousChapters: chapters.slice(0, chapterIndex),
          totalChapters: chapters.length,
          keyElements,
          openaiApiKey,
        }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || `Further expansion for chapter ${chapterIndex + 1} failed`);
      }
      const data = await response.json();
      const newExpanded = [...expandedChapters];
      newExpanded[chapterIndex] = data.details;
      setExpandedChapters(newExpanded);
      const newCounts = [...expansionCounts];
      newCounts[chapterIndex] = (newCounts[chapterIndex] || 0) + 1;
      setExpansionCounts(newCounts);
      setStatus(`Chapter ${chapterIndex + 1} expanded further (${newCounts[chapterIndex]}x).`);
      saveProgress();
    } catch (err: any) {
      setError(`Further expansion failed: ${err.message || 'Unknown error'}. Try again.`);
      setRawError(err.rawResponse || '');
    } finally {
      setChapterLoading(null);
    }
  };

  const handleRegenerateChapter = async (chapterIndex: number) => {
    if (chapterLoading !== null) return;
    setChapterLoading(chapterIndex);
    setError('');
    setRawError('');
    try {
      const chapter = chapters[chapterIndex];
      const customPrompt = chapterPrompts[chapterIndex] || '';
      const openaiApiKey = getStoredApiKey();
      setStatus(`Regenerating chapter ${chapterIndex + 1} ("${chapter.title}") with custom prompt...`);
      const response = await fetch('/api/expand-chapter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          condensedDraft,
          title: chapter.title,
          summary: chapter.summary,
          keyEvents: chapter.keyEvents || [],
          characterTraits: chapter.characterTraits || [],
          timeline: chapter.timeline || 'Unknown timeline',
          model,
          customPrompt,
          chapterIndex,
          previousChapters: chapters.slice(0, chapterIndex),
          totalChapters: chapters.length,
          keyElements,
          openaiApiKey,
        }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw handleApiError(errData, response) || new Error(`Regeneration for chapter ${chapterIndex + 1} failed`);
      }
      const data = await response.json();
      const newExpanded = [...expandedChapters];
      newExpanded[chapterIndex] = data.details;
      setExpandedChapters(newExpanded);
      const newCounts = [...expansionCounts];
      newCounts[chapterIndex] = 0;
      setExpansionCounts(newCounts);

      // Regenerate image prompt and image
      setStatus(`Regenerating image for chapter ${chapterIndex + 1}...`);
      const imagePromptResponse = await fetch('/api/generate-image-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: chapter.title,
          summary: chapter.summary,
          chapterText: data.details,
          model,
          apiKey: openaiApiKey,
          globalImageStyle,
        }),
      });

      let imagePrompt = '';
      let imageUrl = '';

      if (imagePromptResponse.ok) {
        const imagePromptData = await parseJsonResponse(imagePromptResponse, 'generate-image-prompt');
        imagePrompt = imagePromptData.imagePrompt;

        const imageResponse = await fetch('/api/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imagePrompt,
            apiKey: openaiApiKey,
            title: chapter.title,
            summary: chapter.summary,
            imageType: 'chapter',
            globalImageStyle,
          }),
        });

        if (imageResponse.ok) {
          const imageData = await parseJsonResponse(imageResponse, 'generate-image');
          imageUrl = imageData.imageUrl || '';
          if (!imageUrl && imageData.error) {
            console.warn(`Image generation: ${imageData.error}`);
          }
        }
      }

      // Update chapter with new image info
      const newChapters = [...chapters];
      newChapters[chapterIndex] = {
        ...newChapters[chapterIndex],
        imagePrompt,
        imageUrl,
      };
      setChapters(newChapters);

      setStatus(`Chapter ${chapterIndex + 1} regenerated.`);
      saveProgress();
    } catch (err: any) {
      setError(`Regeneration failed: ${err.message || 'Unknown error'}. Try again.`);
      setRawError(err.rawResponse || '');
    } finally {
      setChapterLoading(null);
    }
  };

  const handleRegenerateChapterImage = async (chapterIndex: number) => {
    if (chapterImageLoading !== null) return;
    setChapterImageLoading(chapterIndex);
    setError('');
    setRawError('');
    try {
      const chapter = chapters[chapterIndex];
      const existingPrompt = chapter.imagePrompt || '';
      if (!existingPrompt.trim()) {
        throw new Error('No existing image prompt. Use "Regen Prompt" first.');
      }
      const openaiApiKey = getStoredApiKey();
      setStatus(`Regenerating image for chapter ${chapterIndex + 1}...`);

      const imageResponse = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imagePrompt: existingPrompt,
          apiKey: openaiApiKey,
          title: chapter.title,
          summary: chapter.summary,
          imageType: 'chapter',
          globalImageStyle,
        }),
      });

      if (!imageResponse.ok) {
        const errData = await parseJsonResponse(imageResponse, 'generate-image error');
        throw new Error(errData.error || 'Failed to regenerate image');
      }

      const imageData = await parseJsonResponse(imageResponse, 'generate-image');
      const imageUrl = imageData.imageUrl || '';
      if (!imageUrl && imageData.error) {
        throw new Error(imageData.error);
      }

      const newChapters = [...chapters];
      newChapters[chapterIndex] = {
        ...newChapters[chapterIndex],
        imageUrl,
      };
      setChapters(newChapters);
      setStatus(`Image regenerated for chapter ${chapterIndex + 1}.`);
      saveProgress();
    } catch (err: any) {
      setError(`Image regeneration failed: ${err.message || 'Unknown error'}`);
    } finally {
      setChapterImageLoading(null);
    }
  };

  const handleRegenerateChapterImagePrompt = async (chapterIndex: number) => {
    if (chapterImagePromptLoading !== null) return;
    setChapterImagePromptLoading(chapterIndex);
    setError('');
    setRawError('');
    try {
      const chapter = chapters[chapterIndex];
      const openaiApiKey = getStoredApiKey();
      setStatus(`Regenerating image prompt for chapter ${chapterIndex + 1}...`);

      const imagePromptResponse = await fetch('/api/generate-image-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: chapter.title,
          summary: chapter.summary,
          chapterText: expandedChapters[chapterIndex] || '',
          model,
          apiKey: openaiApiKey,
        }),
      });

      if (!imagePromptResponse.ok) {
        const errData = await parseJsonResponse(imagePromptResponse, 'generate-image-prompt error');
        throw new Error(errData.error || 'Failed to regenerate image prompt');
      }

      const imagePromptData = await parseJsonResponse(imagePromptResponse, 'generate-image-prompt');
      const imagePrompt = imagePromptData.imagePrompt || '';

      const newChapters = [...chapters];
      newChapters[chapterIndex] = {
        ...newChapters[chapterIndex],
        imagePrompt,
      };
      setChapters(newChapters);
      setStatus(`Image prompt regenerated for chapter ${chapterIndex + 1}.`);
      saveProgress();
    } catch (err: any) {
      setError(`Image prompt regeneration failed: ${err.message || 'Unknown error'}`);
    } finally {
      setChapterImagePromptLoading(null);
    }
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

  const handleRegenerateOutline = async () => {
    if (isLoading) return;
    if (!condensedDraft) {
      setError('Cannot regenerate outline: condensed draft is empty.');
      return;
    }
    if (!keyElements) {
      setError('Cannot regenerate outline: key elements missing. Run Step 2 first.');
      return;
    }
    setIsLoading(true);
    setError('');
    setRawError('');
    setStatus('Regenerating chapter outline with custom prompts...');
    try {
      // First, generate base outline with global prompt
      const enhancedCustomPrompt = `${outlinePrompt || summaryPrompt}

CRITICAL: When applying the above instructions, you MUST regenerate ALL chapter metadata fields:
- Update summaries to reflect the custom prompt modifications
- Regenerate keyEvents to align with and support the updated summaries
- Regenerate characterTraits to match the character roles and developments in the updated summaries
- Update timeline if the custom prompt affects temporal pacing

All four fields must be coherent and internally consistent.`;

      const response = await fetch('/api/generate-outline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ condensedDraft, model, customPrompt: enhancedCustomPrompt, keyElements, openaiApiKey: getStoredApiKey() }),
      });
      if (!response.ok) {
        const errData = await response.json();
        const error = handleApiError(errData, response);
        throw Object.assign(error, { rawResponse: errData.rawResponse || '' });
      }
      const data = await response.json();
      let validatedChapters = data.chapters.map((ch: Chapter) => ({
        title: ch.title || 'Untitled Chapter',
        summary: ch.summary || 'No summary available.',
        keyEvents: Array.isArray(ch.keyEvents) ? ch.keyEvents : [],
        characterTraits: Array.isArray(ch.characterTraits) ? ch.characterTraits : [],
        timeline: ch.timeline || 'Unknown timeline',
      }));

      // Now regenerate chapters with custom prompts
      for (let idx = 0; idx < chapterPrompts.length && idx < validatedChapters.length; idx++) {
        const perChapterPrompt = chapterPrompts[idx];
        if (perChapterPrompt && perChapterPrompt.trim()) {
          try {
            setStatus(`Refining Chapter ${idx + 1} with custom prompt...`);

            // Regenerate full outline but with this chapter's custom prompt as the PRIMARY instruction
            const focusedPrompt = `Generate a 6-10 chapter outline for this novel. CRITICAL REQUIREMENT FOR CHAPTER ${idx + 1}: ${perChapterPrompt}

${enhancedCustomPrompt}

When generating Chapter ${idx + 1}, you MUST ensure the custom requirement is fully incorporated into:
- The chapter summary
- The key events
- The character traits
- The timeline
Everything must reflect the instruction: "${perChapterPrompt}"`;

            const perChapterResponse = await fetch('/api/generate-outline', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ condensedDraft, model, customPrompt: focusedPrompt, keyElements, openaiApiKey: getStoredApiKey() }),
            });

            if (perChapterResponse.ok) {
              const perChapterData = await perChapterResponse.json();
              if (perChapterData.chapters && perChapterData.chapters[idx]) {
                // Replace just this chapter with the refined version
                const updatedChapter = perChapterData.chapters[idx];
                validatedChapters[idx] = {
                  title: updatedChapter.title || validatedChapters[idx].title,
                  summary: updatedChapter.summary || validatedChapters[idx].summary,
                  keyEvents: Array.isArray(updatedChapter.keyEvents) ? updatedChapter.keyEvents : validatedChapters[idx].keyEvents,
                  characterTraits: Array.isArray(updatedChapter.characterTraits) ? updatedChapter.characterTraits : validatedChapters[idx].characterTraits,
                  timeline: updatedChapter.timeline || validatedChapters[idx].timeline,
                };
              }
            }
          } catch (perChapterErr: any) {
            console.warn(`[Frontend] Failed to apply per-chapter prompt to chapter ${idx}: ${perChapterErr.message}`);
          }
        }
      }

      // Preserve existing chapter prompts, expanded chapters, and expansion counts
      const newLen = validatedChapters.length;
      const newExpanded = new Array(newLen).fill('');
      const newCounts = new Array(newLen).fill(0);
      const newPrompts = [...chapterPrompts.slice(0, newLen)];
      while (newPrompts.length < newLen) {
        newPrompts.push('');
      }

      for (let i = 0; i < newLen; i++) {
        newExpanded[i] = expandedChapters[i] || '';
        newCounts[i] = expansionCounts[i] || 0;
      }

      setChapters(validatedChapters);
      setExpandedChapters(newExpanded);
      setExpansionCounts(newCounts);
      setChapterPrompts(newPrompts);
      setStatus('Outline regenerated with per-chapter customizations — ready to expand chapters.');
      saveProgress();
    } catch (err: any) {
      setError(`Outline regeneration failed: ${err.message || 'Unknown error'}`);
      setRawError(err.rawResponse || '');
    } finally {
      setIsLoading(false);
    }
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

  // Generate cover image when all chapters are complete
  const generateCoverImage = async (force = false) => {
    if (coverGenerationInProgress && !force) return;
    if (!chapters.length || !expandedChapters.every(ch => ch)) return;

    try {
      if (!coverGenerationInProgress) {
        setCoverGenerationInProgress(true);
      }
      const openaiApiKey = getStoredApiKey();
      setStatus('Generating book title and cover image...');

      // First, generate a short book title
      const titleResponse = await fetch('/api/generate-book-title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: condensedDraft,
          characters: keyElements?.characters.map(c => c.name).join(', ') || 'Various',
          themes: keyElements?.mainStoryLines.join(', ') || 'Adventure',
          model,
          apiKey: openaiApiKey,
        }),
      });

      let bookTitle = 'Novel';
      if (titleResponse.ok) {
        const titleData = await parseJsonResponse(titleResponse, 'generate-book-title');
        bookTitle = titleData.title || 'Novel';
        setBookTitle(bookTitle);
        console.log('[Frontend] Generated book title:', bookTitle);
      }

      setStatus(`Generating cover image with title: "${bookTitle}"...`);

      // Generate cover image prompt (artistic illustration, not text)
      const coverPromptText = `Professional book cover illustration in artistic style. ${condensedDraft.substring(0, 300)}. Features: ${keyElements?.characters.slice(0, 2).map(c => c.name).join(' and ') || 'main characters'}. Mood: ${keyElements?.mainStoryLines[0] || 'epic adventure'}. Rich colors, dramatic composition, suitable for novel cover art. No text, no typography, no titles, no letters. Do not depict a physical book, book cover mockup, pages, or a photo of a book; depict the scene as standalone art.`;

      const imageResponse = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imagePrompt: coverPromptText,
          apiKey: openaiApiKey,
          title: bookTitle,
          summary: `Book cover for: ${bookTitle}`,
          imageType: 'cover',
          globalImageStyle,
        }),
      });

      if (imageResponse.ok) {
        const imageData = await parseJsonResponse(imageResponse, 'generate-cover-image');
        if (imageData.imageUrl) {
          setCoverImage(imageData.imageUrl);
          setStatus(`Cover image generated with title: "${bookTitle}"!`);
          saveProgress(imageData.imageUrl, bookTitle);
        } else if (imageData.error) {
          setStatus('Cover generation skipped (content filter)');
        }
      } else {
        setStatus('Cover image generation failed, continuing anyway');
      }
    } catch (err) {
      console.error('Failed to generate cover image:', err);
    } finally {
      setCoverGenerationInProgress(false);
    }
  };

  const handleRegenerateAllImages = async () => {
    if (chapterImageLoading !== null || coverGenerationInProgress) {
      setError('Image generation already in progress. Please wait.');
      return;
    }

    const confirmed = window.confirm(
      `Regenerate all images?\n\nThis will regenerate the cover image and images for all ${chapters.length} chapters.\n\nThis may take several minutes.`
    );

    if (!confirmed) return;

    setError('');
    setRawError('');

    // Build updated chapters array locally throughout the function
    let updatedChapters = [...chapters];
    let updatedCoverImage = coverImage;

    // Regenerate cover image
    if (expandedChapters.every(ch => ch)) {
      setCoverGenerationInProgress(true);
      setCoverImage('');
      setStatus('Regenerating all images: Starting with cover...');

      try {
        await new Promise(resolve => setTimeout(resolve, 100));
        const openaiApiKey = getStoredApiKey();

        // Generate title and cover
        const titleResponse = await fetch('/api/generate-book-title', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            summary: condensedDraft,
            characters: keyElements?.characters.map(c => c.name).join(', ') || 'Various',
            themes: keyElements?.mainStoryLines.join(', ') || 'Adventure',
            model,
            apiKey: openaiApiKey,
          }),
        });

        let generatedTitle = bookTitle;
        if (titleResponse.ok) {
          const titleData = await parseJsonResponse(titleResponse, 'generate-book-title');
          generatedTitle = titleData.title || bookTitle;
          setBookTitle(generatedTitle);
        }

        // Generate cover image based on title
        const coverPromptText = `Professional book cover illustration in artistic style. ${condensedDraft.substring(0, 300)}. Features: ${keyElements?.characters.slice(0, 2).map(c => c.name).join(' and ') || 'main characters'}. Mood: ${keyElements?.mainStoryLines[0] || 'epic adventure'}. Rich colors, dramatic composition, suitable for novel cover art. No text, no typography, no titles, no letters. Do not depict a physical book, book cover mockup, pages, or a photo of a book; depict the scene as standalone art.`;

        const imageResponse = await fetch('/api/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imagePrompt: coverPromptText,
            apiKey: openaiApiKey,
            title: generatedTitle,
            summary: `Book cover for: ${generatedTitle}`,
            imageType: 'cover',
            globalImageStyle,
          }),
        });

        if (imageResponse.ok) {
          const imageData = await parseJsonResponse(imageResponse, 'generate-cover-image');
          if (imageData.imageUrl) {
            updatedCoverImage = imageData.imageUrl;
            setCoverImage(updatedCoverImage);
          }
        }
      } catch (err) {
        console.error('Cover image regeneration failed:', err);
      }
    }

    // Regenerate all chapter images
    const openaiApiKey = getStoredApiKey();
    let successCount = 0;
    let failureCount = 0;

    for (let idx = 0; idx < updatedChapters.length; idx++) {
      const chapter = updatedChapters[idx];
      const existingPrompt = chapter.imagePrompt || '';

      if (!existingPrompt.trim()) {
        failureCount++;
        continue;
      }

      try {
        setChapterImageLoading(idx);
        setStatus(`Regenerating images: Chapter ${idx + 1}/${updatedChapters.length}...`);

        const imageResponse = await fetch('/api/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imagePrompt: existingPrompt,
            apiKey: openaiApiKey,
            title: chapter.title,
            summary: chapter.summary,
            imageType: 'chapter',
            globalImageStyle,
          }),
        });

        if (!imageResponse.ok) {
          failureCount++;
          continue;
        }

        const imageData = await parseJsonResponse(imageResponse, 'generate-image');
        const imageUrl = imageData.imageUrl || '';

        if (!imageUrl) {
          failureCount++;
          continue;
        }

        // Update in local array
        updatedChapters[idx] = {
          ...updatedChapters[idx],
          imageUrl,
        };
        successCount++;

        // Small delay between image generation requests to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (err: any) {
        console.error(`Chapter ${idx + 1} image regeneration failed:`, err);
        failureCount++;
      } finally {
        setChapterImageLoading(null);
      }
    }

    // Update state once with all changes, then save
    setChapters(updatedChapters);
    setCoverGenerationInProgress(false);
    setStatus(`Image regeneration complete! ${successCount} chapter images regenerated${failureCount > 0 ? `, ${failureCount} failed` : ''}.`);

    // Save with updated data
    saveProgress(updatedCoverImage);
  };

  const openChapterPreviewInNewTab = (idx: number) => {
    const chapter = chapters[idx];
    const chapterText = expandedChapters[idx];
    if (!chapter || !chapterText) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Chapter ${idx + 1}: ${chapter.title}</title>
        <style>
          body { font-family: Georgia, serif; max-width: 800px; margin: 0 auto; padding: 40px 20px; line-height: 1.8; color: #333; background: #f5f5f5; }
          h1 { font-size: 2.5em; text-align: center; margin-bottom: 10px; }
          .chapter-number { font-size: 1.2em; text-align: center; color: #666; margin-bottom: 30px; }
          img { max-width: 100%; height: auto; margin: 30px 0; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .content { background: white; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
          p { text-align: justify; text-indent: 2em; margin-bottom: 1.5em; }
          p:first-of-type { text-indent: 0; }
          .controls { text-align: center; margin: 30px 0; }
          button { padding: 10px 20px; margin: 5px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 1em; }
          button:hover { background: #2563eb; }
          @media print { body { background: white; padding: 0; } .controls { display: none; } }
        </style>
      </head>
      <body>
        <div class="controls">
          <button onclick="window.print()">🖨️ Print</button>
          <button onclick="window.close()">✕ Close</button>
        </div>
        <div class="content">
          <div class="chapter-number">Chapter ${idx + 1}</div>
          <h1>${chapter.title}</h1>
          ${chapter.imageUrl ? `<img src="${chapter.imageUrl}" alt="Chapter ${idx + 1}: ${chapter.title}">` : ''}
          ${chapterText.split('\n\n').map(para => `<p>${para}</p>`).join('')}
        </div>
      </body>
      </html>
    `;

    const newWindow = window.open();
    if (newWindow) {
      newWindow.document.write(htmlContent);
      newWindow.document.close();
    }
  };

  const openFullBookPreviewInNewTab = () => {
    const chaptersHtml = chapters.map((ch, idx) => `
      <h2 style="page-break-before: always; font-size: 2em; margin-top: 40px; margin-bottom: 20px;">Chapter ${idx + 1}: ${ch.title}</h2>
      ${ch.imageUrl ? `<img src="${ch.imageUrl}" alt="Chapter ${idx + 1}: ${ch.title}" style="max-width: 100%; height: auto; margin: 20px 0;">` : ''}
      ${expandedChapters[idx].split('\n\n').map(para => `<p>${para}</p>`).join('')}
    `).join('');

    const toc = chapters.map((ch, idx) => `<li>Chapter ${idx + 1}: ${ch.title}</li>`).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${bookTitle || 'Novel'}</title>
        <style>
          body { font-family: Georgia, serif; max-width: 900px; margin: 0 auto; padding: 40px 20px; line-height: 1.8; color: #333; background: #f5f5f5; }
          .cover { text-align: center; padding: 60px 20px; background: white; margin-bottom: 40px; border-radius: 8px; }
          .cover-image { max-width: 400px; height: auto; margin: 30px auto; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
          .cover h1 { font-size: 3em; margin: 20px 0; }
          .toc { background: white; padding: 40px; margin: 40px 0; border-radius: 8px; }
          .toc h2 { font-size: 2em; margin-bottom: 20px; }
          .toc ul { list-style: none; padding: 0; }
          .toc li { margin: 10px 0; font-size: 1.1em; }
          .content { background: white; padding: 40px; border-radius: 8px; }
          h2 { font-size: 2.2em; margin-top: 60px; margin-bottom: 20px; }
          img { max-width: 100%; height: auto; margin: 30px 0; }
          p { text-align: justify; text-indent: 2em; margin-bottom: 1.5em; }
          p:first-of-type { text-indent: 0; }
          .controls { text-align: center; margin: 30px 0; position: sticky; top: 0; background: white; padding: 15px 0; border-bottom: 1px solid #ddd; }
          button { padding: 10px 20px; margin: 5px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 1em; }
          button:hover { background: #2563eb; }
          .the-end { text-align: center; font-size: 2em; margin: 60px 0; color: #666; }
          @media print { body { background: white; padding: 0; } .controls { display: none; } }
        </style>
      </head>
      <body>
        <div class="controls">
          <button onclick="window.print()">🖨️ Print</button>
          <button onclick="window.close()">✕ Close</button>
        </div>

        <div class="cover">
          ${coverImage ? `<img src="${coverImage}" alt="Book Cover" class="cover-image">` : '<div style="width: 300px; height: 400px; background: #e5e7eb; margin: 30px auto; display: flex; align-items: center; justify-content: center; color: #999;">No cover image</div>'}
          <h1>${bookTitle || 'Novel'}</h1>
        </div>

        <div class="toc">
          <h2>Table of Contents</h2>
          <ul>${toc}</ul>
        </div>

        <div class="content">
          ${chaptersHtml}
          <div class="the-end">~ The End ~</div>
        </div>
      </body>
      </html>
    `;

    const newWindow = window.open();
    if (newWindow) {
      newWindow.document.write(htmlContent);
      newWindow.document.close();
    }
  };

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
          <label htmlFor="model" className="text-sm text-gray-600">Select Model:</label>
          <select
            id="model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1 text-sm"
          >
            {modelOptions.map((option) => (
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
                  onClick={async () => {
                    setEditingImageStyle(false);
                    saveProgress();
                    
                    // Ask user if they want to regenerate images
                    const confirmed = window.confirm(
                      `Regenerate all ${chapters.length} chapter images with the updated style?\n\nThis may take several minutes.`
                    );
                    
                    if (confirmed) {
                      await regenerateAllChapterImagesWithStyle();
                    }
                  }}
                  className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                >
                  Save Style
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setGlobalImageStyle('Digital illustration, cinematic lighting, dramatic atmosphere, rich color palette, professional fantasy art style, detailed and atmospheric, 4K quality, painterly aesthetic with fine brushwork, moody and immersive environment, warm and cool color contrast, professional concept art');
                    setEditingImageStyle(false);
                    saveProgress();
                    
                    // Ask user if they want to regenerate images
                    const confirmed = window.confirm(
                      `Regenerate all ${chapters.length} chapter images with the updated style?\n\nThis may take several minutes.`
                    );
                    
                    if (confirmed) {
                      await regenerateAllChapterImagesWithStyle();
                    }
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
            disabled={isLoading || (currentStep === 3 && currentChapterIndex >= chapters.length)}
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

      <div className="bg-gray-200 rounded-full h-4">
        <div className="bg-blue-600 h-4 rounded-full" style={{ width: `${progressPercent}%` }}></div>
      </div>
      <p className="text-sm text-gray-600">Progress: {completedSteps}/{totalSteps} steps ({progressPercent}%)</p>

      {status && <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded">{status}</div>}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p>{error}</p>
          {rawError && (
            <details className="mt-2">
              <summary className="cursor-pointer text-sm">Raw Error Response</summary>
              <pre className="text-xs bg-gray-100 p-2 rounded mt-1">{rawError}</pre>
            </details>
          )}
        </div>
      )}
      {saveStatus && (
        <div className={`px-4 py-2 rounded ${saveStatusType === 'success' ? 'bg-green-100 border border-green-400 text-green-700' : 'bg-yellow-100 border border-yellow-400 text-yellow-700'}`}>
          {saveStatus}
        </div>
      )}

      {condensedDraft && (
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
      )}

      {keyElements && (
        <details open={currentStep === 2} className="bg-white p-6 rounded-lg shadow-md">
          <summary className="cursor-pointer font-medium text-blue-600 mb-2">Step 2: Key Elements</summary>
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-800">Characters</h3>
            <ul className="list-disc pl-5">
              {keyElements.characters.map((char, idx) => (
                <li key={idx}>
                  {char.name}: {char.gender}, {char.role}, {char.traits}
                  {char.affiliations ? `, affiliated with ${char.affiliations}` : ''}
                </li>
              ))}
            </ul>
            <h3 className="font-semibold text-gray-800">Key Events</h3>
            <ul className="list-disc pl-5">
              {keyElements.keyEvents.map((event, idx) => <li key={idx}>{event}</li>)}
            </ul>
            <h3 className="font-semibold text-gray-800">Timeline</h3>
            <ul className="list-disc pl-5">
              {keyElements.timeline.map((time, idx) => <li key={idx}>{time}</li>)}
            </ul>
            <h3 className="font-semibold text-gray-800">Unique Details</h3>
            <ul className="list-disc pl-5">
              {keyElements.uniqueDetails.map((detail, idx) => <li key={idx}>{detail}</li>)}
            </ul>
            <h3 className="font-semibold text-gray-800">Main Story Lines</h3>
            <ul className="list-disc pl-5">
              {keyElements.mainStoryLines.map((line, idx) => <li key={idx}>{line}</li>)}
            </ul>
          </div>
        </details>
      )}

      {chapters.length > 0 && (
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
                <p className="text-sm text-gray-600 italic">Summary: {chapter.summary}</p>
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
      )}

      {expandedChapters.some(ch => ch) && (
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
      )}

      {fullStory && chapters.some((_, idx) => expandedChapters[idx]) && (
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
                          disabled={chapterImagePromptLoading !== null}
                          className="px-2 py-1 text-xs border border-gray-300 rounded-md text-gray-600 hover:text-gray-800 hover:border-gray-400 disabled:opacity-50"
                        >
                          {chapterImagePromptLoading === idx ? 'Regenerating...' : 'Regen Prompt'}
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
      )}

      {/* Chapter Preview Modal */}
      {previewChapterIndex !== null && chapters[previewChapterIndex] && expandedChapters[previewChapterIndex] && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-3xl my-8">
            {/* Close Button */}
            <div className="sticky top-0 flex justify-between items-center p-6 bg-white border-b border-gray-200 rounded-t-lg">
              <h2 className="text-2xl font-bold text-gray-800">{chapters[previewChapterIndex].title}</h2>
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
              {chapters[previewChapterIndex].imageUrl && (
                <div className="mb-6">
                  <img
                    src={chapters[previewChapterIndex].imageUrl}
                    alt={`Chapter ${previewChapterIndex + 1}: ${chapters[previewChapterIndex].title}`}
                    className="w-full rounded-lg shadow-md"
                  />
                </div>
              )}

              {/* Chapter Text */}
              <div className="prose prose-lg max-w-none leading-relaxed text-gray-800">
                {expandedChapters[previewChapterIndex].split('\n\n').map((paragraph, pIdx) => (
                  <p key={pIdx} className="mb-4 text-justify indent-8 leading-loose">{paragraph}</p>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 p-6 bg-gray-50 border-t border-gray-200 rounded-b-lg flex justify-end gap-3">
              <button
                onClick={() => openChapterPreviewInNewTab(previewChapterIndex)}
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
      )}

      {/* Full Book Preview Modal */}
      {isPreviewingFullBook && chapters.length > 0 && expandedChapters.some(ch => ch) && (
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
                onClick={() => openFullBookPreviewInNewTab()}
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
      )}
    </div>
  );
});

StoryExpander.displayName = 'StoryExpander';

export default StoryExpander;


import React, { useState, useEffect } from 'react';

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
}

const LOCAL_STORAGE_KEY = 'storyExpanderProgress';
const PROMPTS_STORAGE_KEY = 'storyExpanderPrompts';

const StoryExpander: React.FC = () => {
  const [draft, setDraft] = useState<string>('');
  const [model, setModel] = useState<string>('gpt-5-mini');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [rawError, setRawError] = useState<string>('');
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
        if (promptsRaw) {
          const prompts = JSON.parse(promptsRaw);
          setSummaryPrompt(prompts.summaryPrompt || '');
          setOutlinePrompt(prompts.outlinePrompt || '');
          setModel(prompts.model || (model || 'gpt-5-mini'));
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
          setStatus('Loaded saved progress—draft and prompts restored.');
        } catch (err) {
          console.warn('[Frontend] loadProgress: failed to parse stored progress', err);
          setStatus('Saved progress corrupted—start fresh.');
        }
      } else {
        setStatus('No saved progress found—start fresh with your draft.');
      }
    };
    loadProgress();
  }, []);

  // Persist summary/outline prompts (and model) separately so prompts survive Vite refreshes
  useEffect(() => {
    try {
      const toSave = { summaryPrompt, outlinePrompt, model };
      localStorage.setItem(PROMPTS_STORAGE_KEY, JSON.stringify(toSave));
    } catch (err) {
      console.warn('[Frontend] Failed to save prompts to localStorage', err);
    }
  }, [summaryPrompt, outlinePrompt, model]);

  const saveProgress = () => {
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
    };
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(progress));
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
      for (let i = 0; i < chunks.length; i++) {
        console.log(`[Frontend] Processing chunk ${i + 1}/${chunks.length}`);
        const response = await fetch('/api/summarize-draft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ draft: chunks[i], model, customPrompt: summaryPrompt, chunkIndex: i, totalChunks: chunks.length }),
        });
        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || `Summarization failed for chunk ${i + 1}`);
        }
        const data = await response.json();
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
  const regenerateFromChapterPrompt = async (chapterIndex: number) => {
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
    setStatus(`Regenerating outline from chapter ${chapterIndex + 1} onward...`);

    try {
      const existingOutline = chapters.map((ch) => ({ title: ch.title, summary: ch.summary, keyEvents: ch.keyEvents || [], characterTraits: ch.characterTraits || [], timeline: ch.timeline || '' }));
      const chapterPrompt = chapterPrompts[chapterIndex] || '';

      const instruction = `Preserve the first ${chapterIndex} chapters exactly as provided in the existing outline. Apply the custom prompt for chapter ${chapterIndex + 1}: "${chapterPrompt}". Then REWRITE chapters ${chapterIndex + 1} through the end so they flow logically from the updated chapter ${chapterIndex + 1} — change titles, summaries, key events, character focus, and timelines as needed to maintain coherent arcs. Do NOT preserve the old content of chapters ${chapterIndex + 1}..end; regenerate them fully (they may be substantially different). Keep the total number of chapters the same, and ensure chapter ordering and timeline progression remain clear. Output strictly JSON: an array of chapter objects with fields { "title", "summary", "keyEvents", "characterTraits", "timeline" } and no Markdown or code fences. Provide varied, non-repetitive openings and ensure each chapter advances the plot.`;

      const customPrompt = `${instruction}\nExisting outline: ${JSON.stringify(existingOutline)}\nAdditional outline instructions (if any): ${outlinePrompt || summaryPrompt || ''}`;

      const response = await fetch('/api/generate-outline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ condensedDraft, model, customPrompt, keyElements }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw Object.assign(new Error(errData.error || 'Outline regeneration failed'), { rawResponse: errData.rawResponse || '' });
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
          newExpanded[i] = expandedChapters[i] || '';
          newCounts[i] = expansionCounts[i] || 0;
          newPrompts[i] = chapterPrompts[i] || '';
        } else if (i === chapterIndex) {
          newPrompts[i] = chapterPrompts[i] || '';
        } else {
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
        for (let i = 0; i < chunks.length; i++) {
          console.log(`[Frontend] Processing chunk ${i + 1}/${chunks.length}`);
          const response = await fetch('/api/summarize-draft', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ draft: chunks[i], model, customPrompt: summaryPrompt, chunkIndex: i, totalChunks: chunks.length }),
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
        const response = await fetch('/api/extract-key-elements', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ condensedDraft, model, customPrompt: summaryPrompt }),
        });
        if (!response.ok) {
          const errData = await response.json();
          throw Object.assign(new Error(errData.error || 'Key elements extraction failed'), { rawResponse: errData.rawResponse || '' });
        }
        const data = await response.json();
        setKeyElements(data.keyElements);
        setCurrentStep(2);
        setStatus('Step 2 complete: Key elements extracted (see below).');
        saveProgress();
      } else if (currentStep === 2) {
        setStatus('Step 3: Generating chapter outline...');
        const response = await fetch('/api/generate-outline', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ condensedDraft, model, customPrompt: summaryPrompt, keyElements }),
        });
        if (!response.ok) {
          const errData = await response.json();
          throw Object.assign(new Error(errData.error || 'Outline failed'), { rawResponse: errData.rawResponse || '' });
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
          }),
        });
        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || `Expansion for chapter ${currentChapterIndex + 1} failed`);
        }
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
    if (currentStep === 0 && !condensedDraft) {
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

  const handleExpandMore = async (chapterIndex: number) => {
    if (chapterLoading !== null) return;
    setChapterLoading(chapterIndex);
    setError('');
    setRawError('');
    try {
      const chapter = chapters[chapterIndex];
      const customPrompt = chapterPrompts[chapterIndex] || '';
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
        }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || `Regeneration for chapter ${chapterIndex + 1} failed`);
      }
      const data = await response.json();
      const newExpanded = [...expandedChapters];
      newExpanded[chapterIndex] = data.details;
      setExpandedChapters(newExpanded);
      const newCounts = [...expansionCounts];
      newCounts[chapterIndex] = 0;
      setExpansionCounts(newCounts);
      setStatus(`Chapter ${chapterIndex + 1} regenerated.`);
      saveProgress();
    } catch (err: any) {
      setError(`Regeneration failed: ${err.message || 'Unknown error'}. Try again.`);
      setRawError(err.rawResponse || '');
    } finally {
      setChapterLoading(null);
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
    setStatus('Regenerating chapter outline with custom prompt...');
    try {
      const response = await fetch('/api/generate-outline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ condensedDraft, model, customPrompt: outlinePrompt || summaryPrompt, keyElements }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw Object.assign(new Error(errData.error || 'Outline regeneration failed'), { rawResponse: errData.rawResponse || '' });
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
      setStatus('Outline regenerated — ready to expand chapters.');
      saveProgress();
    } catch (err: any) {
      setError(`Outline regeneration failed: ${err.message || 'Unknown error'}`);
      setRawError(err.rawResponse || '');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    console.log(`[Frontend] useEffect triggered: step=${currentStep}, chapterIndex=${currentChapterIndex}, chapters=${chapters.length}, loading=${isLoading}`);
    if (isLoading || (currentStep === 3 && currentChapterIndex >= chapters.length)) return;
    if (currentStep > 0 || condensedDraft) {
      processStep();
    }
  }, [currentStep, currentChapterIndex, chapters.length, condensedDraft]);

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
        <details open={currentStep === 3 && currentChapterIndex >= chapters.length} className="bg-white p-6 rounded-lg shadow-md">
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

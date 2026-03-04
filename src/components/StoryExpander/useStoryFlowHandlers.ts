import type React from 'react';
import type { Chapter, KeyElements } from './constants';
import {
  summarizeDraft,
  extractKeyElements,
  generateOutline,
  expandChapter,
  expandChapterMore,
  generateImagePrompt,
  generateImage,
} from './api';
import { chunkText, getStoredApiKey } from './utils';

type UseStoryFlowHandlersParams = {
  isLoading: boolean;
  currentStep: number;
  currentChapterIndex: number;
  chapterLoading: number | null;
  draft: string;
  condensedDraft: string;
  summaryPrompt: string;
  outlinePrompt: string;
  model: string;
  globalImageStyle: string;
  keyElements: KeyElements | null;
  chapters: Chapter[];
  expandedChapters: string[];
  expansionCounts: number[];
  chapterPrompts: string[];
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setError: React.Dispatch<React.SetStateAction<string>>;
  setRawError: React.Dispatch<React.SetStateAction<string>>;
  setStatus: React.Dispatch<React.SetStateAction<string>>;
  setCondensedDraft: React.Dispatch<React.SetStateAction<string>>;
  setKeyElements: React.Dispatch<React.SetStateAction<KeyElements | null>>;
  setChapters: React.Dispatch<React.SetStateAction<Chapter[]>>;
  setExpandedChapters: React.Dispatch<React.SetStateAction<string[]>>;
  setExpansionCounts: React.Dispatch<React.SetStateAction<number[]>>;
  setChapterPrompts: React.Dispatch<React.SetStateAction<string[]>>;
  setCurrentStep: React.Dispatch<React.SetStateAction<number>>;
  setCurrentChapterIndex: React.Dispatch<React.SetStateAction<number>>;
  setChapterLoading: React.Dispatch<React.SetStateAction<number | null>>;
  saveProgress: (
    overrideCoverImage?: string,
    overrideBookTitle?: string,
    overrideCoverPrompt?: string,
    overrideChapters?: Chapter[]
  ) => void;
  onAllChaptersExpanded: () => void;
};

export const useStoryFlowHandlers = ({
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
  onAllChaptersExpanded,
}: UseStoryFlowHandlersParams) => {
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
      const existingOutline = chapters.map((ch) => ({
        title: ch.title,
        summary: ch.summary,
        keyEvents: ch.keyEvents || [],
        characterTraits: ch.characterTraits || [],
        timeline: ch.timeline || '',
      }));
      const chapterPrompt = chapterPrompts[chapterIndex] || '';

      const prevChapters = chapters.slice(0, chapterIndex).map((ch, idx) => ({
        index: idx + 1,
        title: ch.title,
        summary: ch.summary,
        expanded: expandedChapters[idx] || '',
        customPrompt: chapterPrompts[idx] || '',
      }));
      const previousContext = prevChapters.length > 0
        ? prevChapters
            .map((pc) => {
              const parts = [`Chapter ${pc.index}: ${pc.title}`, `Summary: ${pc.summary}`];
              if (pc.customPrompt) parts.push(`CustomPrompt: ${pc.customPrompt}`);
              if (pc.expanded) parts.push(`ExpandedText: ${pc.expanded.substring(0, 2000)}`);
              return parts.join('\n');
            })
            .join('\n\n')
        : '';

      const instruction = `Preserve the first ${chapterIndex} chapters exactly as provided in the existing outline. Apply the custom prompt for chapter ${chapterIndex + 1}: "${chapterPrompt}". Then REWRITE chapters ${chapterIndex + 1} through the end so they flow logically from the updated chapter ${chapterIndex + 1} — change titles, summaries, key events, character focus, and timelines as needed to maintain coherent arcs. Do NOT preserve the old content of chapters ${chapterIndex + 1}..end; regenerate them fully (they may be substantially different). Keep the total number of chapters the same, and ensure chapter ordering and timeline progression remain clear.

CRITICAL - Narrative Continuity: Use the previous chapters' summaries and expanded content (provided) as continuing context when creating later chapters. Most importantly:
- Any major plot elements, antagonists, characters, conflicts, or story developments introduced in previous chapters (especially those with custom prompts) MUST be acknowledged and continued in subsequent chapters
- Chapters following a chapter with a custom prompt MUST show how that narrative change affects the broader story arc
- Do NOT introduce new plot elements and then abandon them in the next chapter — ensure introduced elements either drive multiple chapters forward or have explicit narrative resolution
- Each chapter should reference or address the consequences of earlier narrative decisions

Output strictly JSON: an array of chapter objects with fields { "title", "summary", "keyEvents", "characterTraits", "timeline" } and no Markdown or code fences. Provide varied, non-repetitive openings and ensure each chapter advances the plot.`;

      const customPrompt = `${instruction}\n\nPrevious Chapters Context (titles, summaries, custom prompts, and truncated expanded text):\n${previousContext}\n\nExisting outline: ${JSON.stringify(existingOutline)}\nAdditional outline instructions (if any): ${outlinePrompt || summaryPrompt || ''}`;

      let augmentedKeyElements = keyElements;
      const openaiApiKey = getStoredApiKey();
      try {
        const extractPrompt = `Please update and augment the story's key elements based on the following previous chapter context and any custom prompts.\n\nContext:\n${previousContext}\n\nExisting key elements (base): ${JSON.stringify(keyElements)}\n\nAdditional instructions: If the context introduces new characters, factions, recurring antagonists, or major plot threads (for example 'Orks' arriving), include them as persistent key elements so they continue to appear across later chapters. Output a JSON object { characters: [...], keyEvents: [...], timeline: [...], uniqueDetails: [...], mainStoryLines: [...] } with no Markdown or extra text.`;
        const extractData = await extractKeyElements({
          condensedDraft,
          model,
          customPrompt: extractPrompt,
          openaiApiKey,
        });
        const newKE = extractData.keyElements;
        if (newKE) {
          const mergeUnique = (a: any[] = [], b: any[] = []) => {
            const set = new Set(a.map((x) => JSON.stringify(x)));
            b.forEach((x) => set.add(JSON.stringify(x)));
            return Array.from(set).map((s) => JSON.parse(s));
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
      } catch (e) {
        console.warn('[Frontend] augment keyElements failed', e);
      }

      const data = await generateOutline({
        condensedDraft,
        model,
        keyElements: augmentedKeyElements,
        customPrompt,
        openaiApiKey,
      });
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
        setCurrentStep(1);
        setStatus('Step 1 complete: Condensed draft ready (see below).');
        saveProgress();
      } else if (currentStep === 1) {
        setStatus('Step 2: Extracting key elements...');
        const openaiApiKey = getStoredApiKey();
        const data = await extractKeyElements({
          condensedDraft,
          model,
          customPrompt: summaryPrompt,
          openaiApiKey,
        });
        setKeyElements(data.keyElements);
        setCurrentStep(2);
        setStatus('Step 2 complete: Key elements extracted (see below).');
        saveProgress();
      } else if (currentStep === 2) {
        setStatus('Step 3: Generating chapter outline...');
        const enhancedSummaryPrompt = summaryPrompt
          ? `${summaryPrompt}

CRITICAL: When applying the above instructions, you MUST regenerate ALL chapter metadata fields:
- Update summaries to reflect the custom prompt modifications
- Regenerate keyEvents to align with and support the updated summaries
- Regenerate characterTraits to match the character roles and developments in the updated summaries
- Update timeline if the custom prompt affects temporal pacing

All four fields must be coherent and internally consistent.`
          : '';

        const openaiApiKey = getStoredApiKey();
        const data = await generateOutline({
          condensedDraft,
          model,
          keyElements,
          customPrompt: enhancedSummaryPrompt,
          openaiApiKey,
        });
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
        const data = await expandChapter({
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
          apiKey: openaiApiKey,
        });
        const newExpanded = [...expandedChapters];
        newExpanded[currentChapterIndex] = data.details;
        setExpandedChapters(newExpanded);

        let imagePrompt = chapter.imagePrompt || '';
        let imageUrl = chapter.imageUrl || '';

        if (!imageUrl || !imagePrompt) {
          setStatus(`Generating image prompt for chapter ${currentChapterIndex + 1}...`);
          const imagePromptData = await generateImagePrompt({
            title: chapter.title,
            summary: chapter.summary,
            chapterText: data.details,
            model,
            globalImageStyle,
            apiKey: openaiApiKey,
          });
          imagePrompt = imagePromptData.imagePrompt;

          if (imagePrompt) {
            setStatus(`Generating image for chapter ${currentChapterIndex + 1}...`);
            const imageData = await generateImage({
              imagePrompt,
              title: chapter.title,
              summary: chapter.summary,
              imageType: 'chapter',
              globalImageStyle,
              apiKey: openaiApiKey,
            });
            imageUrl = imageData.imageUrl || '';
            if (!imageUrl && imageData.error) {
              console.warn(`Image generation: ${imageData.error}`);
            }
          }
        } else {
          setStatus(`Using existing image for chapter ${currentChapterIndex + 1}...`);
        }

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
          setTimeout(() => onAllChaptersExpanded(), 1000);
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
      const enhancedCustomPrompt = `${outlinePrompt || summaryPrompt}

CRITICAL: When applying the above instructions, you MUST regenerate ALL chapter metadata fields:
- Update summaries to reflect the custom prompt modifications
- Regenerate keyEvents to align with and support the updated summaries
- Regenerate characterTraits to match the character roles and developments in the updated summaries
- Update timeline if the custom prompt affects temporal pacing

All four fields must be coherent and internally consistent.`;

      const data = await generateOutline({
        condensedDraft,
        model,
        keyElements,
        customPrompt: enhancedCustomPrompt,
        openaiApiKey: getStoredApiKey(),
      });
      const validatedChapters = data.chapters.map((ch: Chapter) => ({
        title: ch.title || 'Untitled Chapter',
        summary: ch.summary || 'No summary available.',
        keyEvents: Array.isArray(ch.keyEvents) ? ch.keyEvents : [],
        characterTraits: Array.isArray(ch.characterTraits) ? ch.characterTraits : [],
        timeline: ch.timeline || 'Unknown timeline',
      }));

      for (let idx = 0; idx < chapterPrompts.length && idx < validatedChapters.length; idx++) {
        const perChapterPrompt = chapterPrompts[idx];
        if (perChapterPrompt && perChapterPrompt.trim()) {
          try {
            setStatus(`Refining Chapter ${idx + 1} with custom prompt...`);

            const focusedPrompt = `Generate a 6-10 chapter outline for this novel. CRITICAL REQUIREMENT FOR CHAPTER ${idx + 1}: ${perChapterPrompt}

${enhancedCustomPrompt}

When generating Chapter ${idx + 1}, you MUST ensure the custom requirement is fully incorporated into:
- The chapter summary
- The key events
- The character traits
- The timeline
Everything must reflect the instruction: "${perChapterPrompt}"`;

            const perChapterData = await generateOutline({
              condensedDraft,
              model,
              keyElements,
              customPrompt: focusedPrompt,
              openaiApiKey: getStoredApiKey(),
            });
            if (perChapterData.chapters && perChapterData.chapters[idx]) {
              const updatedChapter = perChapterData.chapters[idx];
              validatedChapters[idx] = {
                title: updatedChapter.title || validatedChapters[idx].title,
                summary: updatedChapter.summary || validatedChapters[idx].summary,
                keyEvents: Array.isArray(updatedChapter.keyEvents)
                  ? updatedChapter.keyEvents
                  : validatedChapters[idx].keyEvents,
                characterTraits: Array.isArray(updatedChapter.characterTraits)
                  ? updatedChapter.characterTraits
                  : validatedChapters[idx].characterTraits,
                timeline: updatedChapter.timeline || validatedChapters[idx].timeline,
              };
            }
          } catch (perChapterErr: any) {
            console.warn(`[Frontend] Failed to apply per-chapter prompt to chapter ${idx}: ${perChapterErr.message}`);
          }
        }
      }

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
      const data = await expandChapterMore({
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
        apiKey: openaiApiKey,
      });
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
      const data = await expandChapter({
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
        apiKey: openaiApiKey,
      });
      const newExpanded = [...expandedChapters];
      newExpanded[chapterIndex] = data.details;
      setExpandedChapters(newExpanded);
      const newCounts = [...expansionCounts];
      newCounts[chapterIndex] = 0;
      setExpansionCounts(newCounts);

      // Preserve existing image if it exists, otherwise generate new one
      let imagePrompt = chapter.imagePrompt || '';
      let imageUrl = chapter.imageUrl || '';

      // Only regenerate image if chapter doesn't have one
      if (!imageUrl || !imagePrompt) {
        // Regenerate image prompt and image
        setStatus(`Regenerating image for chapter ${chapterIndex + 1}...`);
        const imagePromptData = await generateImagePrompt({
          title: chapter.title,
          summary: chapter.summary,
          chapterText: data.details,
          model,
          globalImageStyle,
          apiKey: openaiApiKey,
        });
        imagePrompt = imagePromptData.imagePrompt;

        if (imagePrompt) {
          const imageData = await generateImage({
            imagePrompt,
            title: chapter.title,
            summary: chapter.summary,
            imageType: 'chapter',
            globalImageStyle,
            apiKey: openaiApiKey,
          });
          imageUrl = imageData.imageUrl || '';
          if (!imageUrl && imageData.error) {
            console.warn(`Image generation: ${imageData.error}`);
          }
        }
      } else {
        setStatus(`Using existing image for chapter ${chapterIndex + 1}...`);
      }

      // Update chapter with image info (preserved or new)
      const newChapters = [...chapters];
      newChapters[chapterIndex] = {
        ...newChapters[chapterIndex],
        imagePrompt,
        imageUrl,
      };
      setChapters(newChapters);

      setStatus(`Chapter ${chapterIndex + 1} regenerated.`);
      saveProgress(undefined, undefined, undefined, newChapters);
    } catch (err: any) {
      setError(`Regeneration failed: ${err.message || 'Unknown error'}. Try again.`);
      setRawError(err.rawResponse || '');
    } finally {
      setChapterLoading(null);
    }
  };

  return {
    regenerateFromChapterPrompt,
    processStep,
    handleRegenerateOutline,
    handleExpandMore,
    handleRegenerateChapter,
  };
};

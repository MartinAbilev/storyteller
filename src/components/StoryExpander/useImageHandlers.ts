import type React from 'react';
import { PROMPTS_STORAGE_KEY, type Chapter, type KeyElements } from './constants';
import {
  generateImage,
  generateImagePrompt,
  refreshImageStyle,
  generateBookTitle,
} from './api';
import { getStoredApiKey } from './utils';

type UseImageHandlersParams = {
  draft: string;
  model: string;
  condensedDraft: string;
  globalImageStyle: string;
  chapters: Chapter[];
  expandedChapters: string[];
  coverImage: string;
  bookTitle: string;
  coverPrompt: string;
  coverGenerationInProgress: boolean;
  chapterImageLoading: number | null;
  chapterImagePromptLoading: number | null;
  keyElements: KeyElements | null;
  pendingStyleChangeRef: React.MutableRefObject<boolean>;
  saveProgress: (
    overrideCoverImage?: string,
    overrideBookTitle?: string,
    overrideCoverPrompt?: string,
    overrideChapters?: Chapter[]
  ) => void;
  setError: React.Dispatch<React.SetStateAction<string>>;
  setRawError: React.Dispatch<React.SetStateAction<string>>;
  setStatus: React.Dispatch<React.SetStateAction<string>>;
  setChapters: React.Dispatch<React.SetStateAction<Chapter[]>>;
  setCoverPrompt: React.Dispatch<React.SetStateAction<string>>;
  setCoverImage: React.Dispatch<React.SetStateAction<string>>;
  setBookTitle: React.Dispatch<React.SetStateAction<string>>;
  setGlobalImageStyle: React.Dispatch<React.SetStateAction<string>>;
  setCoverGenerationInProgress: React.Dispatch<React.SetStateAction<boolean>>;
  setChapterImageLoading: React.Dispatch<React.SetStateAction<number | null>>;
  setChapterImagePromptLoading: React.Dispatch<React.SetStateAction<number | null>>;
};

export const useImageHandlers = ({
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
  saveProgress,
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
}: UseImageHandlersParams) => {
  const buildCoverPrompt = () => {
    const basePrompt = `Professional book cover illustration in artistic style. ${condensedDraft.substring(0, 300)}. Features: ${keyElements?.characters.slice(0, 2).map(c => c.name).join(' and ') || 'main characters'}. Mood: ${keyElements?.mainStoryLines[0] || 'epic adventure'}. Rich colors, dramatic composition, suitable for novel cover art. No text, no typography, no titles, no letters. Do not depict a physical book, book cover mockup, pages, or a photo of a book; depict the scene as standalone art.`;
    if (globalImageStyle.trim()) {
      return `${basePrompt} Style: ${globalImageStyle}`;
    }
    return basePrompt;
  };

  const regenerateAllChapterPromptsWithStyle = async () => {
    if (!globalImageStyle.trim() || chapters.length === 0 || expandedChapters.length === 0) {
      return;
    }

    if (!expandedChapters.some((ch) => ch && ch.trim())) {
      return;
    }

    console.log('[Frontend] Regenerating chapter image prompts with current style...');

    const newCoverPrompt = buildCoverPrompt();
    setCoverPrompt(newCoverPrompt);

    const openaiApiKey = getStoredApiKey();
    const updatedChapters = [...chapters];
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

        const imagePromptData = await generateImagePrompt({
          title: chapter.title,
          summary: chapter.summary,
          chapterText,
          model,
          globalImageStyle,
          apiKey: openaiApiKey,
        });
        const newImagePrompt = imagePromptData.imagePrompt;

        if (!newImagePrompt || !newImagePrompt.trim()) {
          failureCount++;
          continue;
        }

        updatedChapters[idx] = {
          ...updatedChapters[idx],
          imagePrompt: newImagePrompt,
        };
        successCount++;
      } catch (err: any) {
        console.error(`Chapter ${idx + 1} image prompt regeneration failed:`, err);
        failureCount++;
      } finally {
        setChapterImagePromptLoading(null);
      }
    }

    setChapters(updatedChapters);
    setStatus(
      `Prompts updated with new style! ${successCount} chapter prompts regenerated${
        failureCount > 0 ? `, ${failureCount} failed` : ''
      }.`
    );
    saveProgress(undefined, undefined, newCoverPrompt, updatedChapters);
  };

  const regenerateAllChapterImagesWithStyle = async () => {
    if (!globalImageStyle.trim() || chapters.length === 0 || expandedChapters.length === 0) {
      return;
    }

    if (!expandedChapters.some((ch) => ch && ch.trim())) {
      return;
    }

    console.log('[Frontend] Regenerating chapter image prompts and images with current style...');

    const newCoverPrompt = buildCoverPrompt();
    setCoverPrompt(newCoverPrompt);

    const openaiApiKey = getStoredApiKey();
    const updatedChapters = [...chapters];
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

        const imagePromptData = await generateImagePrompt({
          title: chapter.title,
          summary: chapter.summary,
          chapterText,
          model,
          globalImageStyle,
          apiKey: openaiApiKey,
        });
        const newImagePrompt = imagePromptData.imagePrompt;

        if (!newImagePrompt || !newImagePrompt.trim()) {
          failureCount++;
          continue;
        }

        updatedChapters[idx] = {
          ...updatedChapters[idx],
          imagePrompt: newImagePrompt,
        };

        const imageData = await generateImage({
          imagePrompt: newImagePrompt,
          title: chapter.title,
          summary: chapter.summary,
          imageType: 'chapter',
          globalImageStyle,
          apiKey: openaiApiKey,
        });
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

        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (err: any) {
        console.error(`Chapter ${idx + 1} image regeneration failed:`, err);
        failureCount++;
      } finally {
        setChapterImagePromptLoading(null);
      }
    }

    setChapters(updatedChapters);
    setStatus(
      `Images updated with new style! ${successCount} chapter images regenerated${
        failureCount > 0 ? `, ${failureCount} failed` : ''
      }.`
    );
    saveProgress(undefined, undefined, newCoverPrompt, updatedChapters);
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
      const styleData = await refreshImageStyle({
        draft: draft.substring(0, 2000),
        model,
        apiKey: openaiApiKey,
      });

      if (styleData.imageStyle) {
        pendingStyleChangeRef.current = true;
        setGlobalImageStyle(styleData.imageStyle);
        setStatus('Image style refreshed!');
        console.log('[Frontend] Refreshed image style:', styleData.imageStyle);
        try {
          const promptsRaw = localStorage.getItem(PROMPTS_STORAGE_KEY) || '{}';
          const prompts = JSON.parse(promptsRaw);
          prompts.globalImageStyle = styleData.imageStyle;
          localStorage.setItem(PROMPTS_STORAGE_KEY, JSON.stringify(prompts));
          console.log('[Frontend] Saved refreshed style to PROMPTS_STORAGE_KEY');
        } catch (e) {
          console.warn('[Frontend] Failed to save refreshed style:', e);
        }
      } else {
        setError('Failed to refresh image style');
      }
    } catch (err) {
      setError(`Error refreshing image style: ${err}`);
      console.warn('Error refreshing image style:', err);
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

      const imageData = await generateImage({
        imagePrompt: existingPrompt,
        title: chapter.title,
        summary: chapter.summary,
        imageType: 'chapter',
        globalImageStyle,
        apiKey: openaiApiKey,
      });
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
      saveProgress(undefined, undefined, undefined, newChapters);
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

      const imagePromptData = await generateImagePrompt({
        title: chapter.title,
        summary: chapter.summary,
        chapterText: expandedChapters[chapterIndex] || '',
        model,
        globalImageStyle,
        apiKey: openaiApiKey,
      });
      const imagePrompt = imagePromptData.imagePrompt || '';

      const newChapters = [...chapters];
      newChapters[chapterIndex] = {
        ...newChapters[chapterIndex],
        imagePrompt,
      };
      setChapters(newChapters);
      setStatus(`Image prompt regenerated for chapter ${chapterIndex + 1}.`);
      saveProgress(undefined, undefined, undefined, newChapters);
    } catch (err: any) {
      setError(`Image prompt regeneration failed: ${err.message || 'Unknown error'}`);
    } finally {
      setChapterImagePromptLoading(null);
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

    const updatedChapters = [...chapters];
    let updatedCoverImage = coverImage;
    let updatedCoverPrompt = coverPrompt;

    if (expandedChapters.every((ch) => ch)) {
      setCoverGenerationInProgress(true);
      setCoverImage('');
      setStatus('Regenerating all images: Starting with cover...');

      try {
        await new Promise((resolve) => setTimeout(resolve, 100));
        const openaiApiKey = getStoredApiKey();

        const titleData = await generateBookTitle({
          summary: condensedDraft,
          characters: keyElements?.characters.map((c) => c.name).join(', ') || 'Various',
          themes: keyElements?.mainStoryLines.join(', ') || 'Adventure',
          model,
          apiKey: openaiApiKey,
        });
        const generatedTitle = titleData.title || bookTitle;
        setBookTitle(generatedTitle);

        const coverPromptText = buildCoverPrompt();
        setCoverPrompt(coverPromptText);
        updatedCoverPrompt = coverPromptText;

        const imageData = await generateImage({
          imagePrompt: coverPromptText,
          title: generatedTitle,
          summary: `Book cover for: ${generatedTitle}`,
          imageType: 'cover',
          globalImageStyle,
          apiKey: openaiApiKey,
        });
        if (imageData.imageUrl) {
          updatedCoverImage = imageData.imageUrl;
          setCoverImage(updatedCoverImage);
        }
      } catch (err) {
        console.error('Cover image regeneration failed:', err);
      }
    }

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

        const imageData = await generateImage({
          imagePrompt: existingPrompt,
          title: chapter.title,
          summary: chapter.summary,
          imageType: 'chapter',
          globalImageStyle,
          apiKey: openaiApiKey,
        });
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

        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (err: any) {
        console.error(`Chapter ${idx + 1} image regeneration failed:`, err);
        failureCount++;
      } finally {
        setChapterImageLoading(null);
      }
    }

    setChapters(updatedChapters);
    setCoverGenerationInProgress(false);
    setStatus(
      `Image regeneration complete! ${successCount} chapter images regenerated${
        failureCount > 0 ? `, ${failureCount} failed` : ''
      }.`
    );

    saveProgress(updatedCoverImage, undefined, updatedCoverPrompt);
  };

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
      const titleData = await generateBookTitle({
        summary: condensedDraft,
        characters: keyElements?.characters.map(c => c.name).join(', ') || 'Various',
        themes: keyElements?.mainStoryLines.join(', ') || 'Adventure',
        model,
        apiKey: openaiApiKey,
      });
      let generatedTitle = titleData.title || 'Novel';
      setBookTitle(generatedTitle);
      console.log('[Frontend] Generated book title:', generatedTitle);

      setStatus(`Generating cover image with title: "${generatedTitle}"...`);

      // Generate cover image prompt (artistic illustration, not text)
      const coverPromptText = buildCoverPrompt();
      setCoverPrompt(coverPromptText);

      const imageData = await generateImage({
        imagePrompt: coverPromptText,
        title: generatedTitle,
        summary: `Book cover for: ${generatedTitle}`,
        imageType: 'cover',
        globalImageStyle,
        apiKey: openaiApiKey,
      });
      if (imageData.imageUrl) {
        setCoverImage(imageData.imageUrl);
        setStatus(`Cover image generated with title: "${generatedTitle}"!`);
        saveProgress(imageData.imageUrl, generatedTitle, coverPromptText);
      } else if (imageData.error) {
        setStatus('Cover generation skipped (content filter)');
      }
    } catch (err) {
      console.error('Failed to generate cover image:', err);
    } finally {
      setCoverGenerationInProgress(false);
    }
  };

  return {
    regenerateAllChapterPromptsWithStyle,
    regenerateAllChapterImagesWithStyle,
    handleRefreshImageStyle,
    handleRegenerateChapterImage,
    handleRegenerateChapterImagePrompt,
    handleRegenerateAllImages,
    generateCoverImage,
  };
};

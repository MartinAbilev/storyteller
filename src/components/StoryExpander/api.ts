// API service functions for StoryExpander component

import { parseJsonResponse, handleApiError } from './utils';
import type { KeyElements, Chapter } from './constants';

type ChapterImageType = 'chapter' | 'cover';

type SummarizeDraftParams = {
  draft: string;
  model: string;
  chunkIndex: number;
  totalChunks: number;
  customPrompt?: string;
  openaiApiKey?: string;
};

type ExtractKeyElementsParams = {
  condensedDraft: string;
  model: string;
  customPrompt?: string;
  openaiApiKey?: string;
};

type GenerateOutlineParams = {
  condensedDraft: string;
  model: string;
  keyElements: KeyElements | null;
  customPrompt?: string;
  openaiApiKey?: string;
};

type ExpandChapterParams = {
  condensedDraft: string;
  title: string;
  summary: string;
  model: string;
  chapterIndex: number;
  totalChapters: number;
  keyElements: KeyElements | null;
  customPrompt?: string;
  previousChapters?: Chapter[];
  keyEvents?: string[];
  characterTraits?: string[];
  timeline?: string;
  apiKey?: string;
};

type ExpandChapterMoreParams = {
  condensedDraft: string;
  title: string;
  summary: string;
  model: string;
  chapterIndex: number;
  totalChapters: number;
  keyElements: KeyElements | null;
  existingDetails: string;
  customPrompt?: string;
  previousChapters?: Chapter[];
  keyEvents?: string[];
  characterTraits?: string[];
  timeline?: string;
  apiKey?: string;
};

type GenerateImageParams = {
  imagePrompt: string;
  title: string;
  summary: string;
  imageType?: ChapterImageType;
  globalImageStyle?: string;
  apiKey?: string;
};

type GenerateImagePromptParams = {
  title: string;
  summary: string;
  chapterText: string;
  model: string;
  globalImageStyle?: string;
  apiKey?: string;
};

type RefreshImageStyleParams = {
  draft: string;
  model: string;
  apiKey?: string;
};

type GenerateBookTitleParams = {
  summary: string;
  characters: string;
  themes: string;
  model: string;
  apiKey?: string;
};

/**
 * Summarize a draft chunk
 */
export const summarizeDraft = async (
  params: SummarizeDraftParams
): Promise<{ condensedChunk: string; chunkIndex: number; totalChunks: number }> => {
  const {
    draft,
    model,
    chunkIndex,
    totalChunks,
    customPrompt = '',
    openaiApiKey = '',
  } = params;

  const response = await fetch('/api/summarize-draft', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      draft,
      model,
      customPrompt,
      chunkIndex,
      totalChunks,
      openaiApiKey,
    }),
  });

  if (!response.ok) {
    const errData = await response.json();
    throw handleApiError(errData, response);
  }

  return parseJsonResponse(response, 'summarize-draft');
};

/**
 * Extract key elements from condensed draft
 */
export const extractKeyElements = async (
  params: ExtractKeyElementsParams
): Promise<{ keyElements: KeyElements }> => {
  const {
    condensedDraft,
    model,
    customPrompt = '',
    openaiApiKey = '',
  } = params;

  const response = await fetch('/api/extract-key-elements', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      condensedDraft,
      model,
      customPrompt,
      openaiApiKey,
    }),
  });

  if (!response.ok) {
    const errData = await response.json();
    throw handleApiError(errData, response);
  }

  return parseJsonResponse(response, 'extract-key-elements');
};

/**
 * Generate chapter outline
 */
export const generateOutline = async (
  params: GenerateOutlineParams
): Promise<{ chapters: Chapter[] }> => {
  const {
    condensedDraft,
    model,
    keyElements,
    customPrompt = '',
    openaiApiKey = '',
  } = params;

  const response = await fetch('/api/generate-outline', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      condensedDraft,
      model,
      keyElements,
      customPrompt,
      openaiApiKey,
    }),
  });

  if (!response.ok) {
    const errData = await response.json();
    throw handleApiError(errData, response);
  }

  return parseJsonResponse(response, 'generate-outline');
};

/**
 * Expand a single chapter
 */
export const expandChapter = async (
  params: ExpandChapterParams
): Promise<{ details: string }> => {
  const {
    condensedDraft,
    title,
    summary,
    model,
    chapterIndex,
    totalChapters,
    keyElements,
    customPrompt = '',
    previousChapters = [],
    keyEvents = [],
    characterTraits = [],
    timeline = '',
    apiKey = '',
  } = params;

  const response = await fetch('/api/expand-chapter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      condensedDraft,
      title,
      summary,
      model,
      chapterIndex,
      totalChapters,
      keyElements,
      customPrompt,
      previousChapters,
      keyEvents,
      characterTraits,
      timeline,
      openaiApiKey: apiKey,
    }),
  });

  if (!response.ok) {
    const errData = await response.json();
    throw handleApiError(errData, response);
  }

  return parseJsonResponse(response, 'expand-chapter');
};

/**
 * Expand chapter further (add more detail)
 */
export const expandChapterMore = async (
  params: ExpandChapterMoreParams
): Promise<{ details: string }> => {
  const {
    condensedDraft,
    title,
    summary,
    model,
    chapterIndex,
    totalChapters,
    keyElements,
    existingDetails,
    customPrompt = '',
    previousChapters = [],
    keyEvents = [],
    characterTraits = [],
    timeline = '',
    apiKey = '',
  } = params;

  const response = await fetch('/api/expand-chapter-more', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      condensedDraft,
      title,
      summary,
      model,
      chapterIndex,
      totalChapters,
      keyElements,
      existingDetails,
      customPrompt,
      previousChapters,
      keyEvents,
      characterTraits,
      timeline,
      openaiApiKey: apiKey,
    }),
  });

  if (!response.ok) {
    const errData = await response.json();
    throw new Error(errData.error || `Further expansion for chapter ${chapterIndex + 1} failed`);
  }

  return parseJsonResponse(response, 'expand-chapter-more');
};

/**
 * Generate image for chapter or cover
 */
export const generateImage = async (
  params: GenerateImageParams
): Promise<{ imageUrl: string; error?: string }> => {
  const {
    imagePrompt,
    title,
    summary,
    imageType = 'chapter',
    globalImageStyle = '',
    apiKey = '',
  } = params;

  const response = await fetch('/api/generate-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imagePrompt,
      title,
      summary,
      imageType,
      globalImageStyle,
      apiKey,
    }),
  });

  if (!response.ok) {
    const errData = await response.json();
    throw new Error(errData.error || 'Image generation failed');
  }

  return parseJsonResponse(response, 'generate-image');
};

/**
 * Generate image prompt for chapter
 */
export const generateImagePrompt = async (
  params: GenerateImagePromptParams
): Promise<{ imagePrompt: string }> => {
  const {
    title,
    summary,
    chapterText,
    model,
    globalImageStyle = '',
    apiKey = '',
  } = params;

  const response = await fetch('/api/generate-image-prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title,
      summary,
      chapterText,
      model,
      globalImageStyle,
      apiKey,
    }),
  });

  if (!response.ok) {
    const errData = await response.json();
    throw new Error(errData.error || 'Image prompt generation failed');
  }

  return parseJsonResponse(response, 'generate-image-prompt');
};

/**
 * Regenerate image style based on draft
 */
export const refreshImageStyle = async (
  params: RefreshImageStyleParams
): Promise<{ imageStyle: string }> => {
  const {
    draft,
    model,
    apiKey = '',
  } = params;

  const response = await fetch('/api/generate-image-style', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      draft,
      model,
      apiKey,
    }),
  });

  if (!response.ok) {
    const errData = await response.json();
    throw new Error(errData.error || 'Failed to refresh image style');
  }

  return parseJsonResponse(response, 'generate-image-style');
};

/**
 * Generate a book title from the story summary
 */
export const generateBookTitle = async (
  params: GenerateBookTitleParams
): Promise<{ title: string }> => {
  const {
    summary,
    characters,
    themes,
    model,
    apiKey = '',
  } = params;

  const response = await fetch('/api/generate-book-title', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      summary,
      characters,
      themes,
      model,
      apiKey,
    }),
  });

  if (!response.ok) {
    const errData = await response.json();
    throw new Error(errData.error || 'Failed to generate book title');
  }

  return parseJsonResponse(response, 'generate-book-title');
};

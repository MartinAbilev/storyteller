// Storage keys
export const LOCAL_STORAGE_KEY = 'storyExpanderProgress';
export const PROMPTS_STORAGE_KEY = 'storyExpanderPrompts';

// Interfaces
export interface Character {
  name: string;
  gender: string;
  role: string;
  traits: string;
  affiliations?: string;
}

export interface KeyElements {
  characters: Character[];
  keyEvents: string[];
  timeline: string[];
  uniqueDetails: string[];
  mainStoryLines: string[];
}

export interface Chapter {
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

// Model options for all available LLMs
export const MODEL_OPTIONS = [
  { value: 'gpt-4o-mini', label: 'GPT-4o-mini (Legacy)' },
  { value: 'gpt-4o', label: 'GPT-4o (Legacy)' },
  { value: 'gpt-5-mini', label: 'GPT-5 mini (Fast & Cheap) - Default' },
  { value: 'gpt-5.2', label: 'GPT-5.2 (Best for coding)' },
  { value: 'gpt-5.2-pro', label: 'GPT-5.2 pro (Smartest)' },
];

// Global image style template
export const GLOBAL_IMAGE_STYLE = `Digital illustration, cinematic lighting, dramatic atmosphere, rich color palette, professional fantasy art style, detailed and atmospheric, 4K quality, painterly aesthetic with fine brushwork, moody and immersive environment, warm and cool color contrast, professional concept art`;

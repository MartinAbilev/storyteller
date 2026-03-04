// Utility functions for StoryExpander component

/**
 * Chunk text into smaller pieces by sentence
 */
export const chunkText = (text: string, maxBytes = 50000): string[] => {
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

/**
 * Create SHA-256 hash of text
 */
export const hashDraft = async (text: string): Promise<string> => {
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

/**
 * Convert image URL to Base64 data URL
 */
export const imageUrlToBase64 = async (url: string): Promise<string> => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Failed to convert image to base64:', error);
    return url; // Return original URL if conversion fails
  }
};

/**
 * Helper to get stored API key from localStorage
 */
export const getStoredApiKey = (): string => {
  try {
    const stored = localStorage.getItem('apiKeysStorage');
    if (stored) {
      const keys = JSON.parse(stored) as any;
      return keys.openai || '';
    }
  } catch (e) {
    console.error('Failed to get stored API key:', e);
  }
  return '';
};

/**
 * Helper to handle API errors
 */
export const handleApiError = (error: any, response?: Response): Error => {
  if (response?.status === 401) {
    return new Error(
      error?.error ||
      'API key not found. Add your key in Settings (⚙️) or use OPENAI_API_KEY in .env. Settings take priority.'
    );
  }
  return error || new Error('Unknown error');
};

/**
 * Parse JSON response safely
 */
export const parseJsonResponse = async (response: Response, context: string): Promise<any> => {
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

/**
 * Estimate tokens in text (rough approximation)
 */
export const estimateTokens = (text: string): number => text.split(/\s+/).length * 1.3;

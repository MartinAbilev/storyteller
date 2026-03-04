// Copy utilities for copying content with embedded images

import { imageUrlToBase64 } from './utils';

/**
 * Copy HTML content with embedded images to clipboard
 */
export const copyContentToClipboard = async (
  htmlContent: string,
  imageUrls: string[],
  onStatus: (msg: string) => void,
  onError: (msg: string) => void
): Promise<void> => {
  try {
    onStatus('Converting images for copy...');
    let htmlWithEmbeddedImages = htmlContent;

    // Replace image URLs with base64 data
    for (const imageUrl of imageUrls) {
      if (imageUrl) {
        const base64 = await imageUrlToBase64(imageUrl);
        htmlWithEmbeddedImages = htmlWithEmbeddedImages.replace(
          new RegExp(`src="${imageUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'g'),
          `src="${base64}"`
        );
      }
    }

    // Copy to clipboard
    const blob = new Blob([htmlWithEmbeddedImages], { type: 'text/html' });
    const data = [new ClipboardItem({ 'text/html': blob })];
    await navigator.clipboard.write(data);
    onStatus('Content copied to clipboard with images! Paste into Google Docs.');
    setTimeout(() => onStatus(''), 3000);
  } catch (error) {
    console.error('Failed to copy content:', error);
    onError('Failed to copy content. Try right-clicking and selecting "Copy".');
  }
};

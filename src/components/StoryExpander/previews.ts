// Preview utilities for opening chapters and books in new tabs

import { imageUrlToBase64 } from './utils';
import type { Chapter } from './constants';

/**
 * Open chapter preview in new tab with embedded images
 */
export const openChapterPreviewInNewTab = async (
  idx: number,
  chapter: Chapter,
  chapterText: string,
  onError: (msg: string) => void
): Promise<void> => {
  if (!chapter || !chapterText) return;

  try {
    // Convert chapter image to Base64 if it exists
    let embeddedImageSrc = '';
    if (chapter.imageUrl) {
      try {
        embeddedImageSrc = await imageUrlToBase64(chapter.imageUrl);
      } catch (err) {
        console.error('Failed to convert chapter image:', err);
        embeddedImageSrc = chapter.imageUrl; // Fallback to original URL
      }
    }

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
          ${embeddedImageSrc ? `<img src="${embeddedImageSrc}" alt="Chapter ${idx + 1}: ${chapter.title}">` : ''}
          ${chapterText.split('\n\n').map(para => `<p>${para}</p>`).join('')}
        </div>
      </body>
      </html>
    `;

    // Create blob and open in new tab
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const blobUrl = URL.createObjectURL(blob);
    window.open(blobUrl, '_blank');
  } catch (err) {
    console.error('Error opening chapter preview:', err);
    onError(`Failed to open chapter preview: ${err}`);
  }
};

/**
 * Open full book preview in new tab with embedded images
 */
export const openFullBookPreviewInNewTab = async (
  chapters: Chapter[],
  expandedChapters: string[],
  bookTitle: string,
  coverImage: string,
  onError: (msg: string) => void,
  onStatus?: (msg: string) => void
): Promise<void> => {
  try {
    if (onStatus) onStatus('Embedding images in preview (this may take a moment)...');

    // Collect all image URLs
    const imageMap: { [key: string]: string } = {};
    const urlsToConvert: string[] = [];

    if (coverImage) {
      urlsToConvert.push(coverImage);
    }

    chapters.forEach(ch => {
      if (ch.imageUrl) {
        urlsToConvert.push(ch.imageUrl);
      }
    });

    // Convert all images to Base64
    for (const url of urlsToConvert) {
      if (!imageMap[url]) {
        try {
          imageMap[url] = await imageUrlToBase64(url);
        } catch (err) {
          console.error(`Failed to convert image ${url}:`, err);
          imageMap[url] = url; // Fallback to original URL
        }
      }
    }

    // Build HTML with embedded images
    const chaptersHtml = chapters
      .map((ch, idx) => `
        <h2 style="page-break-before: always; font-size: 2em; margin-top: 40px; margin-bottom: 20px;">Chapter ${idx + 1}: ${ch.title}</h2>
        ${ch.imageUrl ? `<img src="${imageMap[ch.imageUrl] || ch.imageUrl}" alt="Chapter ${idx + 1}: ${ch.title}" style="max-width: 100%; height: auto; margin: 20px 0;">` : ''}
        ${expandedChapters[idx].split('\n\n').map(para => `<p>${para}</p>`).join('')}
      `)
      .join('');

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
          ${
            coverImage
              ? `<img src="${imageMap[coverImage] || coverImage}" alt="Book Cover" class="cover-image">`
              : '<div style="width: 300px; height: 400px; background: #e5e7eb; margin: 30px auto; display: flex; align-items: center; justify-content: center; color: #999;">No cover image</div>'
          }
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

    // Create blob and open in new tab
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const blobUrl = URL.createObjectURL(blob);
    const newWindow = window.open(blobUrl, '_blank');

    if (newWindow) {
      if (onStatus) {
        onStatus('Book preview opened! Images are embedded. Use Google Translate to copy in other languages.');
        setTimeout(() => onStatus?.(''), 3000);
      }
    } else {
      onError('Failed to open preview window. Check if pop-ups are blocked.');
    }
  } catch (err) {
    console.error('Error opening book preview:', err);
    onError(`Failed to open book preview: ${err}`);
  }
};

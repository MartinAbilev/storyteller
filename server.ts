import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const estimateTokens = (text: string): number => text.split(/\s+/).length * 1.3;

const chunkText = (text: string, maxWords = 5000): string[] => {
  const sentences = text.match(/[^.!?]+[.!?]+/gs) || [text];
  const chunks: string[] = [];
  let currentChunk = '';
  for (const sentence of sentences) {
    if ((currentChunk.split(/\s+/).length + sentence.split(/\s+/).length) > maxWords) {
      if (currentChunk) chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk += ' ' + sentence;
    }
  }
  if (currentChunk) chunks.push(currentChunk.trim());
  return chunks;
};

const cleanJsonResponse = (text: string): string => {
  return text
    .replace(/^```json\s*\n?/, '')
    .replace(/\n?```$/, '')
    .replace(/^\s*[\[\{]/, match => match.trim())
    .replace(/,\s*([\]\}])/g, '$1');
};

const generateWithModel = async (prompt: string, model: string, retries = 3, isFallback = false): Promise<string> => {
  console.log(`[Backend] Generating with OpenAI model "${model}" (prompt length: ${prompt.length} chars, retries left: ${retries}, fallback: ${isFallback})`);

  // Use max_completion_tokens for GPT-5 and its variants, max_tokens for others
  const tokenParam = model.startsWith('gpt-5') ? { max_completion_tokens: 4000 } : { max_tokens: 4000 };

  try {
    const completion = await openai.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      ...tokenParam,
    });
    const output = completion.choices[0]?.message?.content || '';
    if (!output) {
      throw new Error('Empty response from OpenAI API');
    }
    console.log(`[Backend] OpenAI output: ${output.slice(0, 200)}... (total: ${output.length} chars)`);
    return output;
  } catch (error: any) {
    console.error(`[Backend] Generation error: ${error.message || error}`);
    if (retries > 0) {
      console.log(`[Backend] Retrying with same model... (${retries - 1} left)`);
      return generateWithModel(prompt, model, retries - 1, isFallback);
    }
    if (!isFallback && model !== 'gpt-4o-mini') {
      console.log(`[Backend] Falling back to gpt-4o-mini...`);
      return generateWithModel(prompt, 'gpt-4o-mini', 3, true);
    }
    throw error;
  }
};

app.post('/api/summarize-draft', async (req, res) => {
  try {
    const { draft, model, customPrompt } = req.body;
    if (!draft) return res.status(400).json({ error: 'Draft required' });

    const chunks = chunkText(draft);
    console.log(`[Backend] Summarizing ${chunks.length} chunks (total ~${estimateTokens(draft)} tokens)`);
    let condensedDraft = '';
    for (let i = 0; i < chunks.length; i++) {
      console.log(`[Backend] Processing chunk ${i + 1}/${chunks.length} (~${estimateTokens(chunks[i])} tokens)`);
      const summarizePrompt = `
        Summarize this story chunk concisely (200-400 words), preserving key plot, characters, tone, and details. Focus on narrative flow.
        ${customPrompt ? `Additional instructions: ${customPrompt}` : ''}
        Chunk ${i + 1}/${chunks.length}: ${chunks[i]}
      `;
      const summary = await generateWithModel(summarizePrompt, model);
      condensedDraft += summary + ' ';
    }
    console.log(`[Backend] Condensed draft complete: ${condensedDraft.slice(0, 200)}... (~${estimateTokens(condensedDraft)} tokens)`);
    res.json({ condensedDraft });
  } catch (error: any) {
    console.error(`[Backend] Summarization error: ${error.message || error}`);
    res.status(500).json({ error: `Summarization failed: ${error.message || 'Unknown error'}` });
  }
});

app.post('/api/generate-outline', async (req, res) => {
  try {
    const { condensedDraft, model, customPrompt } = req.body;
    if (!condensedDraft) return res.status(400).json({ error: 'Condensed draft required' });

    console.log(`[Backend] Generating outline (~${estimateTokens(condensedDraft)} tokens)`);
    const outlinePrompt = `
      Analyze this condensed story draft and split it into 6-10 high-level chapters for a cohesive novel structure.
      For each: - Title (catchy, 1 line). - Summary (3-5 sentences).
      ${customPrompt ? `Additional instructions: ${customPrompt}` : ''}
      Output a valid JSON array: [{ "title": "...", "summary": "..." }].
      Ensure the response is strictly JSON, with no Markdown, code fences, or extra text.
      Condensed Draft: ${condensedDraft.substring(0, 10000)}... (trimmed)
    `;
    const outlineText = await generateWithModel(outlinePrompt, model);
    const cleanedText = cleanJsonResponse(outlineText);
    let chapters;
    try {
      chapters = JSON.parse(cleanedText);
      if (!Array.isArray(chapters) || !chapters.every(ch => ch.title && ch.summary)) {
        throw new Error('Invalid chapter structure');
      }
    } catch (parseError: any) {
      console.error(`[Backend] JSON parse error: ${parseError.message}, raw response: ${cleanedText.slice(0, 500)}...`);
      // Fallback: Retry with a simplified prompt to ensure JSON output
      if (!cleanedText) {
        console.log(`[Backend] Empty response, retrying with simplified prompt...`);
        const simplifiedPrompt = `
          Summarize this story draft into 6-10 chapters as a JSON array: [{ "title": "...", "summary": "..." }].
          Each title is 1 line, each summary is 3-5 sentences.
          ${customPrompt ? `Additional instructions: ${customPrompt}` : ''}
          Draft: ${condensedDraft.substring(0, 10000)}...
        `;
        const retryText = await generateWithModel(simplifiedPrompt, model);
        const retryCleaned = cleanJsonResponse(retryText);
        try {
          chapters = JSON.parse(retryCleaned);
          if (!Array.isArray(chapters) || !chapters.every(ch => ch.title && ch.summary)) {
            throw new Error('Invalid chapter structure in retry');
          }
        } catch (retryError: any) {
          console.error(`[Backend] Retry JSON parse error: ${retryError.message}, raw response: ${retryCleaned.slice(0, 500)}...`);
          throw Object.assign(new Error(`Invalid JSON response: ${retryError.message}`), { rawResponse: retryCleaned });
        }
      } else {
        throw Object.assign(new Error(`Invalid JSON response: ${parseError.message}`), { rawResponse: cleanedText });
      }
    }
    console.log(`[Backend] Generated ${chapters.length} chapters: ${JSON.stringify(chapters[0], null, 2).slice(0, 200)}...`);
    res.json({ chapters });
  } catch (error: any) {
    console.error(`[Backend] Outline error: ${error.message || error}, raw response: ${error.rawResponse || 'N/A'}`);
    res.status(500).json({ error: `Outline generation failed: ${error.message || 'Unknown error'}`, rawResponse: error.rawResponse || '' });
  }
});

app.post('/api/expand-chapter', async (req, res) => {
  try {
    const { condensedDraft, title, summary, model, customPrompt, chapterIndex, previousChapters, totalChapters } = req.body;
    if (!title || !summary) return res.status(400).json({ error: 'Chapter title and summary required' });

    console.log(`[Backend] Expanding chapter "${title}" (index: ${chapterIndex}, total: ${totalChapters})`);
    // Build previous chapters context if chapterIndex > 0
    let previousContext = '';
    if (chapterIndex > 0 && previousChapters && Array.isArray(previousChapters)) {
      previousContext = 'Previous Chapters Context:\n';
      previousChapters.forEach((ch: { title: string; summary: string }, idx: number) => {
        if (idx < chapterIndex) {
          previousContext += `Chapter ${idx + 1}: ${ch.title}\nSummary: ${ch.summary}\nKey Details: Maintain continuity with prior events and characters (e.g., Inquisitor Valeria is female, Captain Zorath is male).\n\n`;
        }
      });
      // Truncate to avoid token overflow
      previousContext = previousContext.substring(0, 1000 * chapterIndex);
    }

    // Add finale instruction for the last chapter
    const isFinalChapter = chapterIndex === totalChapters - 1;
    const finaleInstruction = isFinalChapter
      ? 'This is the final chapter. Conclude the story with a climactic, cohesive ending, resolving key plotlines and character arcs (e.g., Inquisitor Valeria’s mission, Captain Zorath’s fate) while maintaining the grimdark tone.'
      : '';

    const expandPrompt = `
      Expand this chapter into a detailed, coherent narrative (800-1500 words).
      Use vivid, immersive language matching the original draft's style/tone. Ensure plot continuity.
      ${previousContext ? `${previousContext}\n` : ''}
      ${finaleInstruction ? `${finaleInstruction}\n` : ''}
      ${customPrompt ? `Additional instructions: ${customPrompt}` : ''}
      Reference full context: ${condensedDraft.substring(0, 5000)}...
      Title: ${title}. Summary: ${summary}
    `;
    const details = await generateWithModel(expandPrompt, model);
    console.log(`[Backend] Expanded chapter "${title}": ${details.slice(0, 200)}...`);
    res.json({ details });
  } catch (error: any) {
    console.error(`[Backend] Expansion error: ${error.message || error}`);
    res.status(500).json({ error: `Chapter expansion failed: ${error.message || 'Unknown error'}` });
  }
});

app.post('/api/expand-chapter-more', async (req, res) => {
  try {
    const { condensedDraft, title, summary, existingDetails, model, customPrompt, chapterIndex, previousChapters, totalChapters } = req.body;
    if (!title || !summary || !existingDetails) return res.status(400).json({ error: 'Title, summary, and existing details required' });

    console.log(`[Backend] Expanding chapter "${title}" further (index: ${chapterIndex}, total: ${totalChapters})`);
    // Build previous chapters context if chapterIndex > 0
    let previousContext = '';
    if (chapterIndex > 0 && previousChapters && Array.isArray(previousChapters)) {
      previousContext = 'Previous Chapters Context:\n';
      previousChapters.forEach((ch: { title: string; summary: string }, idx: number) => {
        if (idx < chapterIndex) {
          previousContext += `Chapter ${idx + 1}: ${ch.title}\nSummary: ${ch.summary}\nKey Details: Maintain continuity with prior events and characters (e.g., Inquisitor Valeria is female, Captain Zorath is male).\n\n`;
        }
      });
      // Truncate to avoid token overflow
      previousContext = previousContext.substring(0, 1000 * chapterIndex);
    }

    // Add finale instruction for the last chapter
    const isFinalChapter = chapterIndex === totalChapters - 1;
    const finaleInstruction = isFinalChapter
      ? 'This is the final chapter. Conclude the story with a climactic, cohesive ending, resolving key plotlines and character arcs (e.g., Inquisitor Valeria’s mission, Captain Zorath’s fate) while maintaining the grimdark tone.'
      : '';

    const expandMorePrompt = `
      Expand this existing chapter narrative by adding 500-1000 words, continuing the story seamlessly.
      Maintain the same style, tone, and plot continuity as the existing text.
      ${previousContext ? `${previousContext}\n` : ''}
      ${finaleInstruction ? `${finaleInstruction}\n` : ''}
      ${customPrompt ? `Additional instructions: ${customPrompt}` : ''}
      Reference full context: ${condensedDraft.substring(0, 5000)}...
      Title: ${title}
      Summary: ${summary}
      Existing Narrative: ${existingDetails.substring(0, 10000)}... (trimmed)
    `;
    const additionalDetails = await generateWithModel(expandMorePrompt, model);
    const updatedDetails = existingDetails + '\n\n' + additionalDetails;
    console.log(`[Backend] Further expanded chapter "${title}": ${updatedDetails.slice(0, 200)}...`);
    res.json({ details: updatedDetails });
  } catch (error: any) {
    console.error(`[Backend] Further expansion error: ${error.message || error}`);
    res.status(500).json({ error: `Further expansion failed: ${error.message || 'Unknown error'}` });
  }
});

app.listen(PORT, () => {
  console.log(`[Backend] Running on http://localhost:${PORT} (OpenAI-only with finale instruction)`);
});

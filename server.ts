import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import { Anthropic } from '@ai-sdk/anthropic';

dotenv.config();

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;

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

const generateWithModel = async (prompt: string, useClaude = false, retries = 3): Promise<string> => {
  console.log(`[Backend] Generating with ${useClaude && anthropic ? 'Claude' : 'OpenAI'} (prompt length: ${prompt.length} chars, retries left: ${retries})`);
  try {
    // if (useClaude && anthropic) {
    //   const response = await anthropic.createChatCompletion({
    //     model: 'claude-3-5-sonnet-20240620',
    //     messages: [{ role: 'user', content: prompt }],
    //     max_tokens: 4000,
    //   });
    //   const output = response.choices[0]?.message?.content || '';
    //   console.log(`[Backend] Claude output: ${output.slice(0, 200)}... (total: ${output.length} chars)`);
    //   return output;
    // }
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4000,
    });
    const output = completion.choices[0]?.message?.content || '';
    console.log(`[Backend] OpenAI output: ${output.slice(0, 200)}... (total: ${output.length} chars)`);
    return output;
  } catch (error: any) {
    console.error(`[Backend] Generation error: ${error.message || error}`);
    if (retries > 0) {
      console.log(`[Backend] Retrying... (${retries - 1} left)`);
      return generateWithModel(prompt, useClaude, retries - 1);
    }
    throw error;
  }
};

app.post('/api/summarize-draft', async (req, res) => {
  try {
    const { draft, useClaude, customPrompt } = req.body;
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
      const summary = await generateWithModel(summarizePrompt, useClaude);
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
    const { condensedDraft, useClaude } = req.body;
    if (!condensedDraft) return res.status(400).json({ error: 'Condensed draft required' });

    console.log(`[Backend] Generating outline (~${estimateTokens(condensedDraft)} tokens)`);
    const outlinePrompt = `
      Analyze this condensed story draft and split it into 6-10 high-level chapters for a cohesive novel structure.
      For each: - Title (catchy, 1 line). - Summary (3-5 sentences).
      Output a valid JSON array: [{ "title": "...", "summary": "..." }].
      Ensure the response is strictly JSON, with no Markdown, code fences, or extra text.
      Condensed Draft: ${condensedDraft.substring(0, 10000)}... (trimmed)
    `;
    const outlineText = await generateWithModel(outlinePrompt, useClaude);
    const cleanedText = cleanJsonResponse(outlineText);
    let chapters;
    try {
      chapters = JSON.parse(cleanedText);
      if (!Array.isArray(chapters) || !chapters.every(ch => ch.title && ch.summary)) {
        throw new Error('Invalid chapter structure');
      }
    } catch (parseError: any) {
      console.error(`[Backend] JSON parse error: ${parseError.message}, raw response: ${cleanedText.slice(0, 500)}...`);
      throw Object.assign(new Error(`Invalid JSON response: ${parseError.message}`), { rawResponse: cleanedText });
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
    const { condensedDraft, title, summary, useClaude, customPrompt } = req.body;
    if (!title || !summary) return res.status(400).json({ error: 'Chapter title and summary required' });

    console.log(`[Backend] Expanding chapter "${title}"`);
    const expandPrompt = `
      Expand this chapter into a detailed, coherent narrative (800-1500 words).
      Use vivid, immersive language matching the original draft's style/tone. Ensure plot continuity.
      ${customPrompt ? `Additional instructions: ${customPrompt}` : ''}
      Reference full context: ${condensedDraft.substring(0, 5000)}...
      Title: ${title}. Summary: ${summary}
    `;
    const details = await generateWithModel(expandPrompt, useClaude);
    console.log(`[Backend] Expanded chapter "${title}": ${details.slice(0, 200)}...`);
    res.json({ details });
  } catch (error: any) {
    console.error(`[Backend] Expansion error: ${error.message || error}`);
    res.status(500).json({ error: `Chapter expansion failed: ${error.message || 'Unknown error'}` });
  }
});

app.post('/api/expand-chapter-more', async (req, res) => {
  try {
    const { condensedDraft, title, summary, existingDetails, useClaude, customPrompt } = req.body;
    if (!title || !summary || !existingDetails) return res.status(400).json({ error: 'Title, summary, and existing details required' });

    console.log(`[Backend] Expanding chapter "${title}" further`);
    const expandMorePrompt = `
      Expand this existing chapter narrative by adding 500-1000 words, continuing the story seamlessly.
      Maintain the same style, tone, and plot continuity as the existing text.
      ${customPrompt ? `Additional instructions: ${customPrompt}` : ''}
      Reference full context: ${condensedDraft.substring(0, 5000)}...
      Title: ${title}
      Summary: ${summary}
      Existing Narrative: ${existingDetails.substring(0, 10000)}... (trimmed)
    `;
    const additionalDetails = await generateWithModel(expandMorePrompt, useClaude);
    const updatedDetails = existingDetails + '\n\n' + additionalDetails;
    console.log(`[Backend] Further expanded chapter "${title}": ${updatedDetails.slice(0, 200)}...`);
    res.json({ details: updatedDetails });
  } catch (error: any) {
    console.error(`[Backend] Further expansion error: ${error.message || error}`);
    res.status(500).json({ error: `Further expansion failed: ${error.message || 'Unknown error'}` });
  }
});

app.listen(PORT, () => {
  console.log(`[Backend] Running on http://localhost:${PORT} (with custom prompts)`);
});

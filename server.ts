import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';
// import { Anthropic } from '@anthropic-ai/sdk'; // Optional: for Claude

dotenv.config();

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
// const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;

// Rough token estimator (1 word ~1.3 tokens)
const estimateTokens = (text: string): number => text.split(/\s+/).length * 1.3;

interface Chapter {
  title: string;
  summary: string;
  details: string;
}

// Chunk text into ~5k-word pieces
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

const generateWithModel = async (prompt: string, useClaude = false): Promise<string> => {
//   if (useClaude && anthropic) {
//     const response = await anthropic.messages.create({
//       model: 'claude-3-5-sonnet-20240620',
//       max_tokens: 4000,
//       messages: [{ role: 'user', content: prompt }],
//     });
//     return response.content[0].text;
//   }
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini', // Or 'gpt-4o' for more detail
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 4000,
  });
  return completion.choices[0]?.message?.content || '';
};

app.post('/api/expand-story', async (req, res) => {
  try {
    const { draft, useClaude = false } = req.body;
    if (!draft) return res.status(400).json({ error: 'Draft text is required' });

    const totalTokens = estimateTokens(draft);
    console.log(`Draft tokens: ~${Math.round(totalTokens)} (90 pages? That's a novel! Processing in chunks...`);

    // Step 1: Chunk and summarize to a condensed draft (~2-5k words)
    const chunks = chunkText(draft);
    let condensedDraft = '';
    for (let i = 0; i < chunks.length; i++) {
      const summarizePrompt = `
        Summarize this story chunk concisely (200-400 words), preserving key plot, characters, tone, and details. Focus on narrative flow.
        Chunk ${i + 1}/${chunks.length}: ${chunks[i]}
      `;
      const summary = await generateWithModel(summarizePrompt, useClaude);
      condensedDraft += summary + ' ';
      console.log(`Summarized chunk ${i + 1}/${chunks.length}`);
    }

    // Step 2: Generate outline from condensed draft
    const outlinePrompt = `
      Analyze this condensed story draft and split it into 6-10 high-level chapters for a cohesive novel structure.
      For each: - Title (catchy, 1 line). - Summary (3-5 sentences).
      Output JSON array: [{ "title": "...", "summary": "..." }].
      Condensed Draft: ${condensedDraft.substring(0, 10000)}... (trimmed for brevity)
    `;
    const outlineText = await generateWithModel(outlinePrompt, useClaude);
    const chapters: { title: string; summary: string }[] = JSON.parse(outlineText);

    // Step 3: Expand chapters (batch for speed, but sequential for coherence)
    const expandedChapters: Chapter[] = [];
    for (let i = 0; i < chapters.length; i++) {
      const expandPrompt = `
        Expand this chapter into a detailed, coherent narrative (800-1500 words).
        Use vivid, immersive language matching the original draft's style/tone. Ensure plot continuity across chapters.
        Reference full context: ${condensedDraft.substring(0, 5000)}...
        Chapter ${i + 1}: Title: ${chapters[i].title}. Summary: ${chapters[i].summary}
      `;
      const details = await generateWithModel(expandPrompt, useClaude);
      expandedChapters.push({ ...chapters[i], details });
      console.log(`Expanded chapter ${i + 1}/${chapters.length}`);
    }

    // Compile full story
    const fullStory = expandedChapters.map(ch => `### ${ch.title}\n\n${ch.details}\n\n---`).join('\n');

    res.json({
      chapters: expandedChapters,
      fullStory,
      stats: { originalTokens: Math.round(totalTokens), chapters: chapters.length }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Expansion failed—check token limits or API key' });
  }
});

app.listen(PORT, () => {
  console.log(`Backend ready on http://localhost:${PORT} (Long-draft mode: ON)`);
});

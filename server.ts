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

const generateWithModel = async (prompt: string, useClaude = false): Promise<string> => {
  console.log(`Generating with ${useClaude && anthropic ? 'Claude' : 'OpenAI'}...`);
  // if (useClaude && anthropic) {
  //   const response = await anthropic.createChatCompletion({
  //     model: 'claude-3-5-sonnet-20240620',
  //     messages: [{ role: 'user', content: prompt }],
  //     max_tokens: 4000,
  //   });
  //   const output = response.choices[0]?.message?.content || '';
  //   console.log(`Claude output: ${output.slice(0, 200)}...`);
  //   return output;
  // }
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 4000,
  });
  const output = completion.choices[0]?.message?.content || '';
  console.log(`OpenAI output: ${output.slice(0, 200)}...`);
  return output;
};

app.post('/api/summarize-draft', async (req, res) => {
  try {
    const { draft, useClaude } = req.body;
    if (!draft) return res.status(400).json({ error: 'Draft required' });

    const chunks = chunkText(draft);
    let condensedDraft = '';
    for (let i = 0; i < chunks.length; i++) {
      console.log(`Summarizing chunk ${i + 1}/${chunks.length} (~${estimateTokens(chunks[i])} tokens)`);
      const summarizePrompt = `
        Summarize this story chunk concisely (200-400 words), preserving key plot, characters, tone, and details. Focus on narrative flow.
        Chunk ${i + 1}/${chunks.length}: ${chunks[i]}
      `;
      const summary = await generateWithModel(summarizePrompt, useClaude);
      condensedDraft += summary + ' ';
    }
    console.log(`Condensed draft: ${condensedDraft.slice(0, 200)}... (~${estimateTokens(condensedDraft)} tokens)`);
    res.json({ condensedDraft });
  } catch (error) {
    console.error(`Summarization error: ${error}`);
    res.status(500).json({ error: 'Summarization failed' });
  }
});

app.post('/api/generate-outline', async (req, res) => {
  try {
    const { condensedDraft, useClaude } = req.body;
    if (!condensedDraft) return res.status(400).json({ error: 'Condensed draft required' });

    const outlinePrompt = `
      Analyze this condensed story draft and split it into 6-10 high-level chapters for a cohesive novel structure.
      For each: - Title (catchy, 1 line). - Summary (3-5 sentences).
      Output JSON array: [{ "title": "...", "summary": "..." }].
      Condensed Draft: ${condensedDraft.substring(0, 10000)}... (trimmed)
    `;
    const outlineText = await generateWithModel(outlinePrompt, useClaude);
    const chapters = JSON.parse(outlineText);
    console.log(`Generated ${chapters.length} chapters: ${JSON.stringify(chapters[0], null, 2).slice(0, 200)}...`);
    res.json({ chapters });
  } catch (error) {
    console.error(`Outline error: ${error}`);
    res.status(500).json({ error: 'Outline generation failed' });
  }
});

app.post('/api/expand-chapter', async (req, res) => {
  try {
    const { condensedDraft, title, summary, useClaude } = req.body;
    if (!title || !summary) return res.status(400).json({ error: 'Chapter title and summary required' });

    const expandPrompt = `
      Expand this chapter into a detailed, coherent narrative (800-1500 words).
      Use vivid, immersive language matching the original draft's style/tone. Ensure plot continuity.
      Reference full context: ${condensedDraft.substring(0, 5000)}...
      Title: ${title}. Summary: ${summary}
    `;
    const details = await generateWithModel(expandPrompt, useClaude);
    console.log(`Expanded chapter "${title}": ${details.slice(0, 200)}...`);
    res.json({ details });
  } catch (error) {
    console.error(`Expansion error: ${error}`);
    res.status(500).json({ error: 'Chapter expansion failed' });
  }
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT} (with step logging)`);
});

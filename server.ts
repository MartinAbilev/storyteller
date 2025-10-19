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

const chunkText = (text: string, maxWords = 2000): string[] => {
  const sentences = text.match(/[^.!?]+[.!?]+/gs) || [text];
  const chunks: string[] = [];
  let currentChunk = '';
  let sentenceCount = 0;
  console.log(`[Backend] chunkText: Processing ${sentences.length} sentences`);
  for (const sentence of sentences) {
    const sentenceWords = sentence.split(/\s+/).length;
    if ((currentChunk.split(/\s+/).length + sentenceWords) > maxWords) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        console.log(`[Backend] chunkText: Created chunk ${chunks.length} (~${estimateTokens(currentChunk)} tokens)`);
      }
      currentChunk = sentence;
      sentenceCount = 1;
    } else {
      currentChunk += ' ' + sentence;
      sentenceCount++;
    }
  }
  if (currentChunk) {
    chunks.push(currentChunk.trim());
    console.log(`[Backend] chunkText: Created final chunk ${chunks.length} (~${estimateTokens(currentChunk)} tokens)`);
  }
  console.log(`[Backend] chunkText: Generated ${chunks.length} chunks from ${sentenceCount} sentences`);
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

app.post('/api/extract-key-elements', async (req, res) => {
  try {
    const { condensedDraft, model, customPrompt } = req.body;
    if (!condensedDraft) return res.status(400).json({ error: 'Condensed draft required' });

    console.log(`[Backend] Extracting key elements (~${estimateTokens(condensedDraft)} tokens)`);
    const extractPrompt = `
      Extract key elements from this condensed novel draft:
      - Characters: List main characters as objects with fields: name, gender, role, traits, and optional affiliations (e.g., {"name": "Character A", "gender": "female", "role": "heroic", "traits": "inquisitor", "affiliations": "Guild"}).
      - Key events: List 5-10 major events in chronological order as strings.
      - Timeline: List timeline points as strings (e.g., "Day 1: Arrival").
      - Unique details: List 5-10 unique world-building or plot elements as strings (e.g., "ancient artifact").
      - Main story key lines: List 3-5 central plot threads as strings.
      ${customPrompt ? `Additional instructions: ${customPrompt}` : ''}
      Output as valid JSON: { "characters": [{...},...], "keyEvents": [...], "timeline": [...], "uniqueDetails": [...], "mainStoryLines": [...] }.
      Condensed Draft: ${condensedDraft.substring(0, 10000)}... (trimmed)
    `;
    const extractText = await generateWithModel(extractPrompt, model);
    const cleanedText = cleanJsonResponse(extractText);
    let keyElements;
    try {
      keyElements = JSON.parse(cleanedText);
      // Validate keyElements structure
      if (
        !Array.isArray(keyElements.characters) ||
        !Array.isArray(keyElements.keyEvents) ||
        !Array.isArray(keyElements.timeline) ||
        !Array.isArray(keyElements.uniqueDetails) ||
        !Array.isArray(keyElements.mainStoryLines)
      ) {
        throw new Error('Incomplete key elements structure');
      }
      // Validate characters have required fields
      keyElements.characters = keyElements.characters.map((char: any, idx: number) => ({
        name: char.name || `Character ${idx + 1}`,
        gender: char.gender || 'Unknown',
        role: char.role || 'Unknown',
        traits: char.traits || 'None',
        affiliations: char.affiliations || '',
      }));
      if (keyElements.characters.some((char: any) => !char.name || !char.gender || !char.role || !char.traits)) {
        throw new Error('Invalid character structure');
      }
    } catch (parseError: any) {
      console.error(`[Backend] JSON parse error: ${parseError.message}, raw response: ${cleanedText.slice(0, 500)}...`);
      // Fallback: Retry with stricter prompt
      console.log(`[Backend] Retrying with stricter prompt...`);
      const strictPrompt = `
        Extract key elements from this condensed novel draft as valid JSON:
        - Characters: Array of objects with name, gender, role, traits, affiliations (e.g., {"name": "Character A", "gender": "female", "role": "heroic", "traits": "inquisitor", "affiliations": "Guild"}).
        - Key events: Array of 5-10 strings.
        - Timeline: Array of strings (e.g., "Day 1: Arrival").
        - Unique details: Array of 5-10 strings.
        - Main story key lines: Array of 3-5 strings.
        ${customPrompt ? `Additional instructions: ${customPrompt}` : ''}
        Output strictly JSON: { "characters": [{...},...], "keyEvents": [...], "timeline": [...], "uniqueDetails": [...], "mainStoryLines": [...] }.
        Draft: ${condensedDraft.substring(0, 10000)}...
      `;
      const retryText = await generateWithModel(strictPrompt, model);
      const retryCleaned = cleanJsonResponse(retryText);
      try {
        keyElements = JSON.parse(retryCleaned);
        keyElements.characters = keyElements.characters.map((char: any, idx: number) => ({
          name: char.name || `Character ${idx + 1}`,
          gender: char.gender || 'Unknown',
          role: char.role || 'Unknown',
          traits: char.traits || 'None',
          affiliations: char.affiliations || '',
        }));
        if (
          !Array.isArray(keyElements.characters) ||
          !Array.isArray(keyElements.keyEvents) ||
          !Array.isArray(keyElements.timeline) ||
          !Array.isArray(keyElements.uniqueDetails) ||
          !Array.isArray(keyElements.mainStoryLines) ||
          keyElements.characters.some((char: any) => !char.name || !char.gender || !char.role || !char.traits)
        ) {
          throw new Error('Invalid structure in retry');
        }
      } catch (retryError: any) {
        console.error(`[Backend] Retry JSON parse error: ${retryError.message}, raw response: ${retryCleaned.slice(0, 500)}...`);
        throw Object.assign(new Error(`Invalid JSON response: ${retryError.message}`), { rawResponse: retryCleaned });
      }
    }
    console.log(`[Backend] Extracted key elements: ${JSON.stringify(keyElements, null, 2).slice(0, 200)}...`);
    res.json({ keyElements });
  } catch (error: any) {
    console.error(`[Backend] Key elements extraction error: ${error.message || error}, raw response: ${error.rawResponse || 'N/A'}`);
    res.status(500).json({ error: `Key elements extraction failed: ${error.message || 'Unknown error'}`, rawResponse: error.rawResponse || '' });
  }
});

app.post('/api/generate-outline', async (req, res) => {
  try {
    const { condensedDraft, model, customPrompt, keyElements } = req.body;
    if (!condensedDraft) return res.status(400).json({ error: 'Condensed draft required' });
    if (!keyElements) return res.status(400).json({ error: 'Key elements required' });

    console.log(`[Backend] Generating outline (~${estimateTokens(condensedDraft)} tokens)`);
    const outlinePrompt = `
      Analyze this condensed novel draft and extract key elements to create a rich, detailed outline for 6-10 high-level chapters.
      Use these key elements: ${JSON.stringify(keyElements)}.
      For each chapter:
      - Title (catchy, 1 line).
      - Summary (5-7 sentences, including key events, character developments, unique details).
      - Key Events (3-5 bullet points).
      - Character Traits Involved (list main characters with traits as strings, e.g., "Character A: heroic, inquisitor").
      - Timeline Position (e.g., Day 1-3).
      ${customPrompt ? `Additional instructions: ${customPrompt}` : ''}
      Output a valid JSON array: [{ "title": "...", "summary": "...", "keyEvents": ["..."], "characterTraits": ["..."], "timeline": "..." }].
      Ensure the response is strictly JSON, with no Markdown, code fences, or extra text.
      Condensed Draft: ${condensedDraft.substring(0, 10000)}... (trimmed)
    `;
    const outlineText = await generateWithModel(outlinePrompt, model);
    const cleanedText = cleanJsonResponse(outlineText);
    let chapters;
    try {
      chapters = JSON.parse(cleanedText);
      if (!Array.isArray(chapters)) {
        throw new Error('Response is not an array');
      }
      chapters = chapters.map((ch: any, idx: number) => ({
        title: ch.title || `Chapter ${idx + 1}`,
        summary: ch.summary || 'No summary available.',
        keyEvents: Array.isArray(ch.keyEvents) ? ch.keyEvents : [],
        characterTraits: Array.isArray(ch.characterTraits) ? ch.characterTraits : [],
        timeline: ch.timeline || 'Unknown timeline',
      }));
      if (chapters.length < 6 || chapters.length > 10) {
        throw new Error(`Invalid number of chapters: ${chapters.length}`);
      }
      if (!chapters.every(ch => ch.title && ch.summary && Array.isArray(ch.keyEvents) && Array.isArray(ch.characterTraits) && ch.timeline)) {
        throw new Error('Invalid chapter structure');
      }
    } catch (parseError: any) {
      console.error(`[Backend] JSON parse error: ${parseError.message}, raw response: ${cleanedText.slice(0, 500)}...`);
      console.log(`[Backend] Retrying with stricter prompt...`);
      const strictPrompt = `
        Create a JSON array of 6-10 chapters based on this condensed novel draft.
        Use these key elements: ${JSON.stringify(keyElements)}.
        Each chapter must have:
        - title: Catchy, 1 line.
        - summary: 5-7 sentences with key events and details.
        - keyEvents: 3-5 bullet points as an array.
        - characterTraits: Array of main characters with traits as strings.
        - timeline: Position (e.g., Day 1-3).
        ${customPrompt ? `Additional instructions: ${customPrompt}` : ''}
        Output strictly JSON: [{ "title": "...", "summary": "...", "keyEvents": ["..."], "characterTraits": ["..."], "timeline": "..." }].
        Draft: ${condensedDraft.substring(0, 10000)}...
      `;
      const retryText = await generateWithModel(strictPrompt, model);
      const retryCleaned = cleanJsonResponse(retryText);
      try {
        chapters = JSON.parse(retryCleaned);
        chapters = chapters.map((ch: any, idx: number) => ({
          title: ch.title || `Chapter ${idx + 1}`,
          summary: ch.summary || 'No summary available.',
          keyEvents: Array.isArray(ch.keyEvents) ? ch.keyEvents : [],
          characterTraits: Array.isArray(ch.characterTraits) ? ch.characterTraits : [],
          timeline: ch.timeline || 'Unknown timeline',
        }));
        if (chapters.length < 6 || chapters.length > 10) {
          throw new Error(`Invalid number of chapters in retry: ${chapters.length}`);
        }
        if (!chapters.every((ch: { title: any; summary: any; keyEvents: any; characterTraits: any; timeline: any; }) => ch.title && ch.summary && Array.isArray(ch.keyEvents) && Array.isArray(ch.characterTraits) && ch.timeline)) {
          throw new Error('Invalid chapter structure in retry');
        }
      } catch (retryError: any) {
        console.error(`[Backend] Retry JSON parse error: ${retryError.message}, raw response: ${retryCleaned.slice(0, 500)}...`);
        throw Object.assign(new Error(`Invalid JSON response: ${retryError.message}`), { rawResponse: retryCleaned });
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
    const { condensedDraft, title, summary, model, customPrompt, chapterIndex, previousChapters, totalChapters, keyElements } = req.body;
    if (!title || !summary) return res.status(400).json({ error: 'Chapter title and summary required' });

    console.log(`[Backend] Expanding chapter "${title}" (index: ${chapterIndex}, total: ${totalChapters})`);
    let previousContext = '';
    if (chapterIndex > 0 && previousChapters && Array.isArray(previousChapters)) {
      previousContext = 'Previous Chapters Context:\n';
      previousChapters.forEach((ch: { title: string; summary: string; keyEvents: string[]; characterTraits: string[]; timeline: string }, idx: number) => {
        if (idx < chapterIndex) {
          previousContext += `Chapter ${idx + 1}: ${ch.title}\nSummary: ${ch.summary}\nKey Events: ${ch.keyEvents.join(', ')}\nCharacter Traits: ${ch.characterTraits.join(', ')}\nTimeline: ${ch.timeline}\n\n`;
        }
      });
      previousContext = previousContext.substring(0, 1000 * chapterIndex);
    }

    const isFinalChapter = chapterIndex === totalChapters - 1;
    const finaleInstruction = isFinalChapter
      ? 'This is the final chapter. Conclude the story with a climactic, cohesive ending, resolving key plotlines and character arcs while maintaining the tone.'
      : '';

    const expandPrompt = `
      Expand this chapter into a detailed, coherent narrative (800-1500 words).
      Use vivid, immersive language matching the original draft's style/tone. Ensure plot continuity.
      Use these key elements: ${JSON.stringify(keyElements)}.
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
    const { condensedDraft, title, summary, existingDetails, model, customPrompt, chapterIndex, previousChapters, totalChapters, keyElements } = req.body;
    if (!title || !summary || !existingDetails) return res.status(400).json({ error: 'Title, summary, and existing details required' });

    console.log(`[Backend] Expanding chapter "${title}" further (index: ${chapterIndex}, total: ${totalChapters})`);
    let previousContext = '';
    if (chapterIndex > 0 && previousChapters && Array.isArray(previousChapters)) {
      previousContext = 'Previous Chapters Context:\n';
      previousChapters.forEach((ch: { title: string; summary: string; keyEvents: string[]; characterTraits: string[]; timeline: string }, idx: number) => {
        if (idx < chapterIndex) {
          previousContext += `Chapter ${idx + 1}: ${ch.title}\nSummary: ${ch.summary}\nKey Events: ${ch.keyEvents.join(', ')}\nCharacter Traits: ${ch.characterTraits.join(', ')}\nTimeline: ${ch.timeline}\n\n`;
        }
      });
      previousContext = previousContext.substring(0, 1000 * chapterIndex);
    }

    const isFinalChapter = chapterIndex === totalChapters - 1;
    const finaleInstruction = isFinalChapter
      ? 'This is the final chapter. Conclude the story with a climactic, cohesive ending, resolving key plotlines and character arcs while maintaining the tone.'
      : '';

    const expandMorePrompt = `
      Expand this existing chapter narrative by adding 500-1000 words, continuing the story seamlessly.
      Maintain the same style, tone, and plot continuity as the existing text.
      Use these key elements: ${JSON.stringify(keyElements)}.
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
  console.log(`[Backend] Running on http://localhost:${PORT} (OpenAI-only with richer outline, fixed chunkText, and validated key elements)`);
});

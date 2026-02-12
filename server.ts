import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import fs from 'fs/promises';
import path from 'path';

dotenv.config();

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: '500mb' }));

// Error handler for JSON parsing issues
// app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
//   if (err instanceof SyntaxError && 'body' in err) {
//     console.error('[Backend] JSON parse error in middleware:', err.message);
//     return res.status(400).json({ error: `Invalid JSON in request body: ${err.message}` });
//   }
//   next(err);
// });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'sk-placeholder' });

const getOpenAIClient = (apiKey?: string): OpenAI => {
  if (apiKey && apiKey.trim() !== '' && apiKey !== 'sk-placeholder') {
    return new OpenAI({ apiKey });
  }
  return openai;
};

const validateApiKey = (apiKey?: string): string | null => {
  // Priority: Settings > Environment Variable
  if (!apiKey || apiKey.trim() === '' || apiKey === 'sk-placeholder') {
    // Settings key not provided, check environment variable
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'sk-placeholder') {
      return 'No OpenAI API key found. Priority: (1) Settings, (2) .env. Please add your OpenAI API key in Settings (⚙️) or set OPENAI_API_KEY in .env file.';
    }
  }
  return null;
};

const estimateTokens = (text: string): number => text.split(/\s+/).length * 1.3;

const chunkText = (text: string, maxWords = 5000): string[] => {
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

const generateWithModel = async (prompt: string, model: string, openaiClient?: OpenAI, retries = 3, isFallback = false): Promise<string> => {
  const client = openaiClient || openai;
  console.log(`[Backend] Generating with OpenAI model "${model}" (prompt length: ${prompt.length} chars, retries left: ${retries}, fallback: ${isFallback})`);

  const tokenParam = model.startsWith('gpt-5') ? { max_completion_tokens: 4000 } : { max_tokens: 4000 };

  try {
    const completion = await client.chat.completions.create({
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
      return generateWithModel(prompt, model, openaiClient, retries - 1, isFallback);
    }
    if (!isFallback && model !== 'gpt-4o-mini') {
      console.log(`[Backend] Falling back to gpt-4o-mini...`);
      return generateWithModel(prompt, 'gpt-4o-mini', openaiClient, 3, true);
    }
    throw error;
  }
};

app.post('/api/summarize-draft', async (req, res) => {
  console.log();
  try {
    const { draft, model, customPrompt, chunkIndex, totalChunks, openaiApiKey } = req.body;
    if (!draft) return res.status(400).json({ error: 'Draft required' });
    if (chunkIndex === undefined || totalChunks === undefined) {
      return res.status(400).json({ error: 'chunkIndex and totalChunks required' });
    }

    const keyError = validateApiKey(openaiApiKey);
    if (keyError) {
      return res.status(401).json({ error: keyError });
    }

    const openaiClient = getOpenAIClient(openaiApiKey);
    console.log(`[Backend] Summarizing chunk ${chunkIndex + 1}/${totalChunks} (~${estimateTokens(draft)} tokens)`);
    const summarizePrompt = `
      Summarize this story chunk concisely (200-400 words), preserving key plot, characters, tone, and details. Focus on narrative flow.
      ${customPrompt ? `Additional instructions: ${customPrompt}` : ''}
      Chunk ${chunkIndex + 1}/${totalChunks}: ${draft}
    `;
    const summary = await generateWithModel(summarizePrompt, model, openaiClient);
    return res.json({ condensedChunk: summary, chunkIndex, totalChunks });
  } catch (error: any) {
    console.error(`[Backend] Summarization error: ${error.message || error}`);
    try {
      return res.status(500).json({ error: `Summarization failed: ${error.message || 'Unknown error'}` });
    } catch (sendError) {
      console.error(`[Backend] Failed to send error response: ${sendError}`);
      if (!res.headersSent) {
        return res.status(500).json({ error: 'Internal server error' });
      }
    }
  }
});

app.post('/api/extract-key-elements', async (req, res) => {
  console.log('extract keys elem');
    const { condensedDraft, model, customPrompt, openaiApiKey } = req.body;
    if (!condensedDraft) return res.status(400).json({ error: 'Condensed draft required' });

    const keyError = validateApiKey(openaiApiKey);
    if (keyError) {
      return res.status(401).json({ error: keyError });
    }

    const openaiClient = getOpenAIClient(openaiApiKey);
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
    const extractText = await generateWithModel(extractPrompt, model, openaiClient);
    const cleanedText = cleanJsonResponse(extractText);
    let keyElements;
    try {
      keyElements = JSON.parse(cleanedText);
      if (
        !Array.isArray(keyElements.characters) ||
        !Array.isArray(keyElements.keyEvents) ||
        !Array.isArray(keyElements.timeline) ||
        !Array.isArray(keyElements.uniqueDetails) ||
        !Array.isArray(keyElements.mainStoryLines)
      ) {
        throw new Error('Incomplete key elements structure');
      }
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
      const retryText = await generateWithModel(strictPrompt, model, openaiClient);
      console.log('KEYELEMENTS', retryText)
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
    return res.json({ keyElements });

});

app.post('/api/generate-outline', async (req, res) => {
  try {
    const { condensedDraft, model, customPrompt, keyElements, openaiApiKey } = req.body;
    if (!condensedDraft) return res.status(400).json({ error: 'Condensed draft required' });
    if (!keyElements) return res.status(400).json({ error: 'Key elements required' });

    const keyError = validateApiKey(openaiApiKey);
    if (keyError) {
      return res.status(401).json({ error: keyError });
    }

    const openaiClient = getOpenAIClient(openaiApiKey);
    console.log(`[Backend] Generating outline (~${estimateTokens(condensedDraft)} tokens)`);
    const outlinePrompt = `
      Create a detailed outline for 6-10 chapters that PROGRESSES the story chronologically from beginning to end.

      CRITICAL: Each chapter must cover DIFFERENT events that move the story forward in time.
      DO NOT assign the same events to multiple chapters.
      Each chapter should represent a distinct phase or progression in the narrative timeline.

      Use these key elements from the story: ${JSON.stringify(keyElements)}.

      For each chapter, provide:
      - Title: Catchy, descriptive (1 line)
      - Summary: 5-7 sentences describing WHAT HAPPENS in this specific chapter, including character developments and plot progression
      - Key Events: 3-5 bullet points of UNIQUE events that occur ONLY in this chapter (not repeated in other chapters)
      - Character Traits Involved: Main characters active in this chapter with their traits (e.g., "Character A: determined, conflicted")
      - Timeline Position: When this chapter occurs (e.g., "Day 1-3", "Week 2", "The Beginning", "The Climax")

      IMPORTANT:
      - Distribute events across chapters so the story PROGRESSES chronologically
      - Each chapter should advance the plot with NEW developments
      - The first chapter should establish/introduce, middle chapters should develop/complicate, final chapter should resolve/conclude
      - Avoid repeating the same event across multiple chapters

      ${customPrompt ? `Additional instructions: ${customPrompt}` : ''}

      Output ONLY valid JSON array with NO markdown, code fences, or extra text:
      [{ "title": "...", "summary": "...", "keyEvents": ["..."], "characterTraits": ["..."], "timeline": "..." }]

      Condensed Draft: ${condensedDraft.substring(0, 10000)}... (trimmed)
    `;
    const outlineText = await generateWithModel(outlinePrompt, model, openaiClient);
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
        Create a JSON array of 6-10 chapters that PROGRESS the story chronologically from beginning to end.

        CRITICAL: Each chapter must have DISTINCT events. Do not repeat events across chapters.
        Distribute events so the story moves forward in time with each chapter.

        Use these key elements: ${JSON.stringify(keyElements)}.

        Each chapter must have:
        - title: Catchy, descriptive (1 line)
        - summary: 5-7 sentences describing what happens in THIS specific chapter
        - keyEvents: 3-5 UNIQUE events as an array (not repeated in other chapters)
        - characterTraits: Array of main characters with traits as strings
        - timeline: When this occurs (e.g., "Day 1-3", "Week 2")

        ${customPrompt ? `Additional instructions: ${customPrompt}` : ''}

        Output ONLY strictly valid JSON with NO markdown or code fences:
        [{ "title": "...", "summary": "...", "keyEvents": ["..."], "characterTraits": ["..."], "timeline": "..." }]

        Draft: ${condensedDraft.substring(0, 10000)}...
      `;
      const retryText = await generateWithModel(strictPrompt, model, openaiClient);
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
    return res.json({ chapters });
  } catch (error: any) {
    console.error(`[Backend] Outline error: ${error.message || error}, raw response: ${error.rawResponse || 'N/A'}`);
    try {
      return res.status(500).json({ error: `Outline generation failed: ${error.message || 'Unknown error'}`, rawResponse: error.rawResponse || '' });
    } catch (sendError) {
      console.error(`[Backend] Failed to send error response: ${sendError}`);
      if (!res.headersSent) {
        return res.status(500).json({ error: 'Internal server error' });
      }
    }
  }
});

app.post('/api/expand-chapter', async (req, res) => {
  try {
    const { condensedDraft, title, summary, model, customPrompt, chapterIndex, previousChapters, totalChapters, keyElements, keyEvents, characterTraits, timeline, openaiApiKey } = req.body;
    if (!title || !summary) return res.status(400).json({ error: 'Chapter title and summary required' });
    if (!keyElements) return res.status(400).json({ error: 'Key elements required' });

    const keyError = validateApiKey(openaiApiKey);
    if (keyError) {
      return res.status(401).json({ error: keyError });
    }

    const openaiClient = getOpenAIClient(openaiApiKey);
    console.log(`[Backend] Expanding chapter "${title}" (index: ${chapterIndex}, total: ${totalChapters})`);
    console.log(`[Backend] Request body: ${JSON.stringify(req.body, null, 2).slice(0, 500)}...`);

    const safeKeyEvents = Array.isArray(keyEvents) ? keyEvents : [];
    const safeCharacterTraits = Array.isArray(characterTraits) ? characterTraits : [];

    // Safely access keyElements properties with fallbacks
    const safeCharacters = Array.isArray(keyElements.characters) ? keyElements.characters : [];
    const safeKeyElementsEvents = Array.isArray(keyElements.keyEvents) ? keyElements.keyEvents : [];
    const safeUniqueDetails = Array.isArray(keyElements.uniqueDetails) ? keyElements.uniqueDetails : [];

    const chapterCharacterNames = safeCharacterTraits.map((trait: string) => trait.split(':')[0].trim());
    const relevantCharacters = safeCharacters.filter((char: any) =>
      chapterCharacterNames.includes(char.name)
    );
    const relevantKeyEvents = safeKeyElementsEvents.filter((event: string) =>
      safeKeyEvents.some((chapterEvent: string) => event.toLowerCase().includes(chapterEvent.toLowerCase().split(' ')[0])) ||
      summary.toLowerCase().includes(event.toLowerCase().split(' ')[0])
    );
    const relevantKeyElements = {
      characters: relevantCharacters,
      keyEvents: relevantKeyEvents,
      uniqueDetails: safeUniqueDetails.filter((detail: string) =>
        summary.toLowerCase().includes(detail.toLowerCase()) ||
        safeKeyEvents.some((event: string) => event.toLowerCase().includes(detail.toLowerCase()))
      ),
    };

    let previousContext = '';
    let eventsAlreadyCovered: string[] = [];
    if (chapterIndex > 0 && previousChapters && Array.isArray(previousChapters)) {
      previousContext = 'EVENTS ALREADY COVERED IN PREVIOUS CHAPTERS (DO NOT REPEAT THESE):\n';
      previousChapters.forEach((ch: { title: string; summary: string; keyEvents: string[]; characterTraits: string[]; timeline: string }, idx: number) => {
        previousContext += `Chapter ${idx + 1}: ${ch.title} - ${ch.summary}\n`;
        if (Array.isArray(ch.keyEvents)) {
          ch.keyEvents.forEach(event => eventsAlreadyCovered.push(event));
          previousContext += `Events: ${ch.keyEvents.join('; ')}\n`;
        }
        previousContext += `Timeline: ${ch.timeline}\n\n`;
      });
      // Limit context size but keep it informative
      previousContext = previousContext.substring(0, 2000);
    }

    // Add finale instruction for the last chapter
    const isFinalChapter = chapterIndex === totalChapters - 1;
    const finaleInstruction = isFinalChapter
      ? '\n\nCRITICAL: This is the FINAL chapter. You must conclude the entire story with a climactic, satisfying ending that resolves all major plotlines and character arcs. Bring the story to a definitive close.'
      : '';

    const expandPrompt = `
      You are writing Chapter ${chapterIndex + 1} of ${totalChapters} in a multi-chapter story.

      CRITICAL INSTRUCTION: This chapter must ADVANCE the plot forward. DO NOT retell or repeat events from previous chapters.
      Each chapter should cover NEW story beats and move the narrative timeline forward.
      ${chapterIndex > 0 ? 'The previous chapters have ALREADY covered certain events - you must START this chapter AFTER those events and move the story FORWARD with NEW developments.' : 'This is the first chapter - establish the story foundation.'}

      ${previousContext}

      YOUR TASK FOR THIS CHAPTER:
      Chapter ${chapterIndex + 1} Title: ${title}
      Chapter ${chapterIndex + 1} Summary: ${summary}
      Chapter ${chapterIndex + 1} Key Events (NEW events for THIS chapter only): ${JSON.stringify(safeKeyEvents)}
      Timeline Position: ${timeline || 'Unknown timeline'}

      INSTRUCTIONS:
      1. Write 800-1500 words focusing ONLY on the events and developments specified for THIS chapter
      2. DO NOT repeat or retell events from previous chapters listed above
      3. Start where the previous chapter left off and ADVANCE the story chronologically
      4. Use unique opening and narrative structure - avoid repeating patterns from other chapters
      5. Focus on these specific characters for this chapter: ${JSON.stringify(relevantCharacters)}
      6. Incorporate these unique details: ${JSON.stringify(relevantKeyElements.uniqueDetails)}
      7. Match the original draft's tone and style: ${condensedDraft.substring(0, 1500)}... (style reference only)

      ${finaleInstruction}
      ${customPrompt ? `\nAdditional custom instructions: ${customPrompt}` : ''}

      Write the chapter now, ensuring it contains NEW story content that moves the plot forward:
    `;




    const details = await generateWithModel(expandPrompt, model, openaiClient);
    console.log(`[Backend] Got details from OpenAI: ${details.length} chars`);
    if (!details || details.trim() === '') {
      console.log(`[Backend] Details are empty, returning 500`);
      return res.status(500).json({ error: 'Empty response from OpenAI API. Try again or use a different model.' });
    }
    console.log(`[Backend] Expanded chapter "${title}": ${details.slice(0, 100)}...`);
    console.log(`[Backend] Sending response`);
    return res.json({ details });
  } catch (error: any) {
    console.error(`[Backend] Expansion error: ${error.message || error}`);
    const errorMsg = error.message || 'Unknown error';
    try {
      return res.status(500).json({ error: `Chapter expansion failed: ${errorMsg}` });
    } catch (sendError) {
      console.error(`[Backend] Failed to send error response: ${sendError}`);
      if (!res.headersSent) {
        return res.status(500).json({ error: 'Internal server error' });
      }
    }
  }
});

// Expand chapter further (adds more content to existing chapter)
app.post('/api/expand-chapter-more', async (req, res) => {
  try {
    const { condensedDraft, title, summary, model, customPrompt, chapterIndex, previousChapters, totalChapters, keyElements, keyEvents, characterTraits, timeline, existingDetails, openaiApiKey } = req.body;
    if (!title || !summary || !existingDetails) return res.status(400).json({ error: 'Chapter title, summary, and existing details required' });

    const keyError = validateApiKey(openaiApiKey);
    if (keyError) {
      return res.status(401).json({ error: keyError });
    }

    const openaiClient = getOpenAIClient(openaiApiKey);
    console.log(`[Backend] Expanding chapter "${title}" further (index: ${chapterIndex})`);

    const expandMorePrompt = `
      You are expanding Chapter ${chapterIndex + 1} of ${totalChapters} with additional details and depth.

      EXISTING CHAPTER CONTENT:
      ${existingDetails}

      YOUR TASK:
      Expand this chapter by adding more depth, detail, and narrative richness. Add 500-800 more words that:
      1. Deepen character development and interactions
      2. Add more sensory details and atmosphere
      3. Expand on key moments with more vivid description
      4. Maintain consistency with the existing content
      5. Keep the same narrative flow and tone

      Chapter Title: ${title}
      Chapter Summary: ${summary}
      Timeline: ${timeline || 'Unknown timeline'}

      ${customPrompt ? `Additional instructions: ${customPrompt}` : ''}

      Write the COMPLETE expanded chapter (combining existing + new content):
    `;

    const details = await generateWithModel(expandMorePrompt, model, openaiClient);
    console.log(`[Backend] Expanded chapter further: ${details.length} chars`);

    return res.json({ details });
  } catch (error: any) {
    console.error(`[Backend] Expand-more error: ${error.message || error}`);
    try {
      return res.status(500).json({ error: `Chapter expansion failed: ${error.message || 'Unknown error'}` });
    } catch (sendError) {
      console.error(`[Backend] Failed to send error response: ${sendError}`);
      if (!res.headersSent) {
        return res.status(500).json({ error: 'Internal server error' });
      }
    }
  }
});


// Generate image prompt for a chapter
app.post('/api/generate-image-prompt', async (req, res) => {
  try {
    const { title, summary, chapterText, model, apiKey } = req.body;
    if (!title || !summary) {
      return res.status(400).json({ error: 'Chapter title and summary required' });
    }

    const keyError = validateApiKey(apiKey);
    if (keyError) return res.status(401).json({ error: keyError });
    const openaiClient = getOpenAIClient(apiKey);

    const promptText = `
      Generate a detailed, vivid image generation prompt for this chapter.
      The prompt should capture the key visual elements, atmosphere, and mood of the chapter.
      Make it suitable for DALL-E 3 image generation (concise but descriptive, under 400 characters).
      Focus on the most visually striking or representative scene from the chapter.

      Chapter Title: ${title}
      Chapter Summary: ${summary}
      ${chapterText ? `Chapter Content Preview: ${chapterText.substring(0, 1000)}...` : ''}

      Return ONLY the image prompt text, nothing else.
    `;

    const imagePrompt = await generateWithModel(promptText, model, openaiClient);
    console.log(`[Backend] Generated image prompt for "${title}": ${imagePrompt.substring(0, 100)}...`);

    return res.json({ imagePrompt: imagePrompt.trim() });
  } catch (error: any) {
    console.error(`[Backend] Image prompt generation error: ${error.message || error}`);
    try {
      return res.status(500).json({ error: `Image prompt generation failed: ${error.message || 'Unknown error'}` });
    } catch (sendError) {
      console.error(`[Backend] Failed to send error response: ${sendError}`);
      if (!res.headersSent) {
        return res.status(500).json({ error: 'Internal server error' });
      }
    }
  }
});

// Generate image using DALL-E 3
app.post('/api/generate-image', async (req, res) => {
  try {
    const { imagePrompt, apiKey, title, summary } = req.body;
    if (!imagePrompt) {
      return res.status(400).json({ error: 'Image prompt required' });
    }

    const keyError = validateApiKey(apiKey);
    if (keyError) return res.status(401).json({ error: keyError });
    const openaiClient = getOpenAIClient(apiKey);

    console.log(`[Backend] Generating image with DALL-E 3: ${imagePrompt.substring(0, 100)}...`);

    try {
      const response = await openaiClient.images.generate({
        model: 'dall-e-3',
        prompt: imagePrompt,
        n: 1,
        size: '1024x1024',
        quality: 'standard',
      });

      if (!response.data || !response.data[0]?.url) {
        throw new Error('No image URL returned from DALL-E 3');
      }

      const imageUrl = response.data[0].url;

      console.log(`[Backend] Generated image URL: ${imageUrl}`);
      return res.json({ imageUrl });
    } catch (imageError: any) {
      // Check if it's a safety system rejection
      if (imageError.message && imageError.message.includes('safety system')) {
        console.log(`[Backend] Image rejected by safety system, attempting with sanitized prompt...`);

        // Generate a more generic, safe prompt
        const safePrompt = `A book cover illustration for a chapter titled "${title || 'Story Chapter'}". Professional, artistic style, appropriate for general audiences. Focus on mood and atmosphere rather than specific content.`;

        console.log(`[Backend] Retry with safe prompt: ${safePrompt}`);

        try {
          const retryResponse = await openaiClient.images.generate({
            model: 'dall-e-3',
            prompt: safePrompt,
            n: 1,
            size: '1024x1024',
            quality: 'standard',
          });

          if (!retryResponse.data || !retryResponse.data[0]?.url) {
            throw new Error('No image URL returned from DALL-E 3 on retry');
          }

          const imageUrl = retryResponse.data[0].url;
          console.log(`[Backend] Generated image with safe prompt: ${imageUrl}`);
          return res.json({ imageUrl, usedSafePrompt: true });
        } catch (retryError: any) {
          console.warn(`[Backend] Safe prompt also failed: ${retryError.message}`);
          // Return success but no image - UI will handle this gracefully
          return res.json({ imageUrl: null, error: 'Could not generate safe image for this chapter' });
        }
      }

      // Re-throw if it's not a safety issue
      throw imageError;
    }
  } catch (error: any) {
    console.error(`[Backend] Image generation error: ${error.message || error}`);
    try {
      return res.status(500).json({ error: `Image generation failed: ${error.message || 'Unknown error'}` });
    } catch (sendError) {
      console.error(`[Backend] Failed to send error response: ${sendError}`);
      if (!res.headersSent) {
        return res.status(500).json({ error: 'Internal server error' });
      }
    }
  }
});

// Save full story state to story.json (frontend should POST the entire progress/state)
app.post('/api/save-state', async (req, res) => {
  try {
    const state = req.body;
    if (!state) return res.status(400).json({ error: 'State JSON required in request body' });
    const filePath = path.join(process.cwd(), './dist/story.json');
    await fs.writeFile(filePath, JSON.stringify(state, null, 2), 'utf8');
    console.log(`[Backend] Saved state to ${filePath}`);
    return res.json({ ok: true, path: filePath });
  } catch (error: any) {
    console.error('[Backend] save-state error:', error.message || error);
    try {
      return res.status(500).json({ error: `Failed to save state: ${error.message || 'Unknown error'}` });
    } catch (sendError) {
      console.error(`[Backend] Failed to send error response: ${sendError}`);
      if (!res.headersSent) {
        return res.status(500).json({ error: 'Internal server error' });
      }
    }
  }
});

// Load saved story state from story.json
app.get('/api/load-state', async (_req, res) => {
  try {
    const filePath = path.join(process.cwd(), 'story.json');
    const data = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(data || '{}');
    return res.json({ ok: true, state: parsed });
  } catch (error: any) {
    console.error('[Backend] load-state error:', error.message || error);
    try {
      return res.status(500).json({ error: `Failed to load state: ${error.message || 'Unknown error'}` });
    } catch (sendError) {
      console.error(`[Backend] Failed to send error response: ${sendError}`);
      if (!res.headersSent) {
        return res.status(500).json({ error: 'Internal server error' });
      }
    }
  }
});

// Global error handler - must be last
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[Backend] Unhandled error:', err.message || err);
  if (!res.headersSent) {
    return res.status(500).json({ error: `Server error: ${err.message || 'Unknown error'}` });
  }
});

app.listen(PORT, () => {
  console.log(`[Backend] Running on http://localhost:${PORT} (OpenAI-only with finale instruction)`);
});

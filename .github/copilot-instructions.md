<!-- Copilot / AI agent guidance for the storyteller repo -->
# AI Agent Instructions — storyteller

Summary
- This repo is a small React + Vite frontend with an Express TypeScript backend that orchestrates OpenAI model calls to summarize, outline, and expand novel drafts. Key files: [server.ts](server.ts), [package.json](package.json), [src/components/StoryExpander.tsx](src/components/StoryExpander.tsx), [readme.md](readme.md).

What to know (big picture)
- Frontend (Vite + React): UI lives in `src/` (entry: `main.tsx`, component: `src/components/StoryExpander.tsx`). The UI posts to backend endpoints and stores progress in `localStorage`.
- Backend (`server.ts`): single Express app exposing endpoints `/api/summarize-draft`, `/api/extract-key-elements`, `/api/generate-outline`, `/api/expand-chapter`. All requests expect JSON and often require specific fields (see Examples below).
- Models & flow: The app chains three main steps — summarize draft (chunked), extract key elements, generate outline, then expand chapters. The backend enforces strict JSON responses and retries with stricter prompts.

Important repository conventions & gotchas
- Model parameter differences: server uses `max_completion_tokens` for `gpt-5*` and `max_tokens` for other models. If you change model names, update `generateWithModel` token param logic in [server.ts](server.ts).
- Fallback behavior: If a model call fails and retries are exhausted, the code falls back to `gpt-4o-mini` (see `generateWithModel`). Do not change fallback behavior without coordinating with the product owner.
- JSON strictness: Endpoints expect strictly parseable JSON. The backend strips markdown fences and retries with a stricter prompt on parse errors (see `cleanJsonResponse` and retry logic in `extract-key-elements` and `generate-outline`). When generating content, prefer producing plain JSON (no code fences).
- Chunking: Large drafts are split by `chunkText` (roughly by sentences, default maxWords ~5000). `POST /api/summarize-draft` requires `chunkIndex` and `totalChunks` fields.

Developer workflows (commands)
- Install:
  ```bash
  npm install
  ```
- Run backend (dev):
  ```bash
  npm run dev:backend
  # runs: nodemon server.ts (ts-node)
  ```
- Run frontend (dev):
  ```bash
  npm run dev:frontend
  # runs: vite on default dev port (3000)
  ```
- Build/preview frontend:
  ```bash
  npm run build
  npm run preview
  ```
- Environment: Backend reads `OPENAI_API_KEY` from environment (`.env` recommended).

API examples & expected payloads
- Summarize chunk (required fields):
  POST `/api/summarize-draft` body: { draft, model, customPrompt?, chunkIndex, totalChunks }
- Extract elements:
  POST `/api/extract-key-elements` body: { condensedDraft, model, customPrompt? }
  Response: JSON object with arrays `characters`, `keyEvents`, `timeline`, `uniqueDetails`, `mainStoryLines`.
- Generate outline:
  POST `/api/generate-outline` body: { condensedDraft, model, keyElements, customPrompt? }
  Response: JSON array of 6–10 chapter objects `{ title, summary, keyEvents, characterTraits, timeline }`.
- Expand chapter:
  POST `/api/expand-chapter` body: { condensedDraft, title, summary, model, chapterIndex, previousChapters?, totalChapters, keyElements, keyEvents?, characterTraits?, timeline?, customPrompt? }
  Response: { details: string } (chapter text).

Code patterns to reuse
- When asking models to return structured data, always instruct: "Output strictly JSON" and remove fences. Use the existing `cleanJsonResponse` approach when parsing.
- Keep retries: the backend retries generation 3 times before fallback. Preserve that logic unless a deliberate change is requested.

Where to edit for model changes
- If you want to change default models (e.g., prefer `gpt-5-mini`), update model selection in the frontend (`src/components/StoryExpander.tsx`) and ensure `generateWithModel` token handling in [server.ts](server.ts) supports any new model name patterns.

Agent preferences (for AI contributors)
- Default generation tone: prioritize narrative continuity and strict JSON for metadata endpoints. For free text (chapter expansion), follow the `800-1500 words` constraint and include finale instruction when `chapterIndex === totalChapters - 1`.
- Model instruction: prefer `gpt-5-mini` as a conservative default for testing; do not remove the existing fallback to `gpt-4o-mini` unless instructed. If you require enabling `gpt-5` for all clients, propose a single change: update the frontend model list and `generateWithModel` token handling — include a short PR with tests and owner approval.

Files to inspect first for any change
- [server.ts](server.ts) — backend logic (chunking, retries, parsing, endpoints)
- [src/components/StoryExpander.tsx](src/components/StoryExpander.tsx) — frontend calls, model selector, localStorage keys
- [package.json](package.json) — dev scripts
- [readme.md](readme.md) — high-level product notes and assumptions

If unclear or missing
- Ask for clarity on desired model default (e.g., enable `gpt-5-mini` for all clients). Changing default models affects cost and API access; confirm product & ops approval.

Done — Feedback
- If you'd like, I can: (1) change the frontend model selector to default to `gpt-5-mini`, (2) update the fallback order in `server.ts`, or (3) add a short test that the backend returns strictly parseable JSON for `generate-outline`. Which should I do next?

# AI Agent Instructions: storyteller

## Start here
- This is a React 19 + Vite frontend with one Express/TypeScript backend. The primary entry points are [server.ts](../server.ts), [src/components/StoryExpander.tsx](../src/components/StoryExpander.tsx), [src/components/StoryExpander/api.ts](../src/components/StoryExpander/api.ts), and [readme.md](../readme.md).
- The main flow is sequential: chunk and summarize a draft, extract key elements, generate an outline, expand chapters, then generate/cache chapter images and a cover.
- Treat `package.json` and `check:node` as authoritative. The README contains older Node and model/fallback details.

## Architecture boundaries
- Keep `StoryExpander.tsx` focused on state wiring and UI composition. Put story-flow behavior in `src/components/StoryExpander/useStoryFlowHandlers.ts` and image behavior in `src/components/StoryExpander/useImageHandlers.ts`.
- Keep frontend request types and payloads in `src/components/StoryExpander/api.ts` synchronized with the matching routes and validation in `server.ts`.
- Reuse existing helpers and patterns in `src/components/StoryExpander/utils.ts` and `server.ts` before adding abstractions.
- Progress and prompts are persisted in browser `localStorage`; progress is also best-effort posted to `/api/save-state`.

## Runtime and validation
- Requires Node.js 20.19+ or 22.12+. Node 21 is unsupported. `npm run dev:frontend`, `npm run build`, and `npm run preview` enforce this through `check:node`.
- Install with `npm install`.
- Run the backend with `npm run dev:backend` (`nodemon server.ts`) and the frontend with `npm run dev:frontend` (Vite on port 3000). Vite proxies `/api` and `/images` to port 3001, so both processes are needed for end-to-end behavior.
- `npm run build` is the available automated frontend check. There is no test or lint script; use focused manual/API checks for backend changes.

## Model and API contracts
- Structured model responses must be valid JSON without Markdown fences. Use `cleanJsonResponse` plus the existing validation/retry pattern in `server.ts`.
- `generateWithModel` retries the requested model, then falls back to `gpt-5-mini` unless that is already the requested model. Models beginning with `gpt-5` use the Responses API; other models use Chat Completions with `max_tokens`.
- The supported model list and default live in `src/components/StoryExpander/constants.ts`; update it and the UI when changing models, then verify the backend model dispatch.
- Draft routes are `/api/summarize-draft`, `/api/extract-key-elements`, `/api/generate-outline`, `/api/expand-chapter`, and `/api/expand-chapter-more`.
- Image routes are `/api/generate-image-style`, `/api/generate-image-prompt`, `/api/generate-image`, and `/api/generate-book-title`. Persistence/preview routes are `/api/save-state`, `/api/load-state`, `/api/preview`, and `GET /preview/:id`.
- `summarize-draft` requires `draft`, `model`, `chunkIndex`, and `totalChunks`. Key-element responses contain `characters`, `keyEvents`, `timeline`, `uniqueDetails`, and `mainStoryLines` arrays. Outline responses contain chapters with `title`, `summary`, `keyEvents`, `characterTraits`, and `timeline`. Chapter expansion returns `{ details: string }`.
- Image calls use `apiKey`; text-generation calls use `openaiApiKey`. Preserve this distinction unless both client and server are deliberately changed together.

## Behavioral constraints
- Preserve narrative continuity: later chapter expansion receives prior chapter context, and the final chapter receives an explicit conclusion instruction.
- Image generation uses DALL-E 3. The backend downloads temporary image URLs into `dist/images/{chapter|cover}` and returns local `/images/...` URLs; do not assume provider URLs are permanent.
- API keys may come from Settings storage or `OPENAI_API_KEY` in `.env`, with Settings taking priority. Never commit keys or print them in logs.
- Save and load currently use different backend paths (`dist/story.json` versus root `story.json`). Verify intended behavior before changing persistence, and check both browser `localStorage` and backend persistence.
- For structured response changes, update backend validation, API wrapper types, and consuming handlers together. Prefer small, focused edits and leave unrelated refactors alone.

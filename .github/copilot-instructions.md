# AI Agent Instructions: storyteller

## Project shape
- This is a React 19 + Vite frontend with a single Express/TypeScript backend. Start with [server.ts](../server.ts), [src/components/StoryExpander.tsx](../src/components/StoryExpander.tsx), [src/components/StoryExpander/api.ts](../src/components/StoryExpander/api.ts), and [readme.md](../readme.md).
- The main user flow is sequential: chunk and summarize a draft, extract key elements, generate a 6-10 chapter outline, expand chapters, then generate/cache images and a cover.
- The frontend is composed from `src/components/StoryExpander/`; keep the top-level `StoryExpander.tsx` focused on state wiring and UI composition, and put story-flow logic in `useStoryFlowHandlers.ts` and image logic in `useImageHandlers.ts`.
- The frontend stores progress and prompts in `localStorage`. It also best-effort POSTs progress to `/api/save-state`.
- `vite.config.ts` runs the frontend on port 3000 and proxies `/api` and `/images` to the backend on port 3001. The two dev processes must both be running for the full app flow.

## Runtime prerequisites
- Use Node.js 20.19+ or 22.12+; `npm run dev:frontend`, `npm run build`, and `npm run preview` enforce this through `check:node`. Node 21 is unsupported.
- The README's older Node 18 prerequisite is stale; treat `package.json` and `check:node` as authoritative.
- Backend development runs TypeScript directly through `nodemon server.ts`; there is no separate backend build script.

## Boundaries and conventions
- Keep API request/response changes synchronized between `server.ts` and `src/components/StoryExpander/api.ts`.
- Keep state-flow changes in `useStoryFlowHandlers.ts` and image workflows in `useImageHandlers.ts`; keep `StoryExpander.tsx` focused on state wiring and UI composition.
- Structured model endpoints must return parseable JSON without Markdown fences. Reuse `cleanJsonResponse` and the existing retry/validation pattern in `server.ts`.
- Preserve the existing retry behavior in `generateWithModel`. Exhausted requests fall back to `gpt-5-mini` unless the requested model is already `gpt-5-mini`; the old `gpt-4o-mini` fallback wording is stale.
- Models beginning with `gpt-5` use the Responses API. Other models use Chat Completions with `max_tokens`; update `generateWithModel` if the model/API contract changes.
- API keys may come from the frontend Settings storage or `OPENAI_API_KEY` in `.env`; Settings takes priority. Never commit keys or print them in logs.
- Preserve narrative continuity: later chapter expansion receives prior chapter context, and the final chapter receives an explicit conclusion instruction.
- Image generation uses DALL-E 3 and caches files under `dist/images`; do not assume generated image URLs are permanent.
- Be aware that save and load currently use different state paths (`dist/story.json` versus `story.json`); verify intended behavior before changing persistence.

## Developer workflows
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
- There is currently no test or lint script in `package.json`. Use `npm run build` as the available frontend validation, and run focused manual/API checks when changing backend behavior.
- Environment: backend reads `OPENAI_API_KEY` from `.env`; the frontend can also send a key configured in Settings.
- Run the backend and frontend in separate terminals for end-to-end checks. A frontend-only build does not validate backend routes or OpenAI request behavior.

## API surface
- Draft pipeline: `/api/summarize-draft`, `/api/extract-key-elements`, `/api/generate-outline`, `/api/expand-chapter`, `/api/expand-chapter-more`.
- Image pipeline: `/api/generate-image-style`, `/api/generate-image-prompt`, `/api/generate-image`, and `/api/generate-book-title`.
- Persistence and previews: `/api/save-state`, `/api/load-state`, `/api/preview`, and `GET /preview/:id`.
- `summarize-draft` requires `draft`, `model`, `chunkIndex`, and `totalChunks`.
- `extract-key-elements` returns `keyElements` with `characters`, `keyEvents`, `timeline`, `uniqueDetails`, and `mainStoryLines` arrays.
- `generate-outline` returns `chapters`; each chapter has `title`, `summary`, `keyEvents`, `characterTraits`, and `timeline`.
- `expand-chapter` and `expand-chapter-more` return `{ details: string }`.
- Image endpoints accept the API key field as `apiKey`, while text endpoints use `openaiApiKey`; preserve that distinction unless deliberately normalizing both sides.
- `/api/generate-image` downloads DALL-E 3's temporary URL into `dist/images/{chapter|cover}` and returns a local `/images/...` URL; preserve this caching behavior when changing image generation.
- `/api/preview` stores generated HTML in memory and `GET /preview/:id` expires entries after roughly five minutes; preview pages are not durable files.

## Change guidance
- For model changes, update the model list/default in `src/components/StoryExpander/constants.ts` and `StoryExpander.tsx`, then verify `generateWithModel` in [server.ts](../server.ts).
- For a new structured response, update the backend validation, the API wrapper types, and the consuming handler together.
- Keep chapter expansion at 800-1500 words and further expansion at roughly 500-800 words unless the product behavior is intentionally changing.
- When touching persistence, verify both browser `localStorage` behavior and the backend paths: save writes `dist/story.json`, while load currently reads root `story.json`.
- Prefer small, focused edits. Do not add a new abstraction or customization file unless it removes real duplication or supports a repeatable workflow.

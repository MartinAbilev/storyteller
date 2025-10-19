# Novel Expander

This project is a web-based tool for expanding a novel draft into a structured, chapter-based narrative using OpenAI's GPT models (e.g., GPT-5, GPT-4o-mini). It takes a draft (e.g., a 90-page story) and processes it through three steps: summarizing the draft, generating a chapter outline, and expanding each chapter with consistent plot, characters, and tone. The tool supports custom prompts, includes previous chapter context for narrative continuity, and adds a climactic finale instruction for the last chapter.

## Features
- **Summarization**: Condenses a draft (up to ~90 pages) into a concise summary (~460 tokens) while preserving key plot, characters, and tone.
- **Chapter Outline**: Generates 6-10 high-level chapters in JSON format, with catchy titles and 3-5 sentence summaries.
- **Chapter Expansion**: Expands each chapter into 800-1500 words, maintaining style and continuity with previous chapters.
- **Further Expansion**: Allows additional 500-1000 word expansions per chapter via the "Expand More" button.
- **Custom Prompts**: Supports user-defined prompts (e.g., "Character A is female, Character B is male, emphasize a specific tone") for summarization and chapter expansion.
- **Previous Chapter Context**: Includes summaries and key details (e.g., character genders) of prior chapters to ensure narrative consistency.
- **Finale Instruction**: Adds a prompt for the last chapter to create a climactic, cohesive ending, resolving key plotlines and character arcs.
- **Model Selector**: Choose between GPT-5, GPT-5-mini, GPT-4o, or GPT-4o-mini for generation.
- **Error Handling**: Retries failed API calls (3 attempts) and falls back to GPT-4o-mini if GPT-5 fails. Handles JSON parse errors with a simplified prompt retry.
- **Progress Saving**: Stores progress in `localStorage` to resume across sessions.

## Prerequisites
- **Node.js**: Version 18 or higher.
- **npm**: For installing dependencies.
- **OpenAI API Key**: Obtain from [OpenAI](https://platform.openai.com/account/api-keys) for GPT model access.
- **Git**: For cloning and managing the repository.

## Setup
1. **Clone the Repository**:
   ```bash
   git clone <your-repo-url>
   cd novel-expander
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```
   Ensure the following are installed:
   - `openai`: Latest version (`npm install openai@latest`)
   - `express`, `cors`, `dotenv` (for backend)
   - `react`, `typescript` (for frontend)

3. **Configure Environment**:
   Create a `.env` file in the root directory:
   ```env
   OPENAI_API_KEY=your_openai_key_here
   ```

4. **Start Servers**:
   - Backend (`server.ts`):
     ```bash
     npm run dev:backend
     ```
     Runs on `http://localhost:3001`.
   - Frontend (`src/components/StoryExpander.tsx`):
     ```bash
     npm run dev:frontend
     ```
     Runs on `http://localhost:3000`.

## Usage
1. **Access the App**:
   Open `http://localhost:3000` in your browser.

2. **Input Your Draft**:
   - Paste your draft (e.g., a 90-page novel) into the textarea.
   - Select a model (e.g., "GPT-5 (PhD-Level, Powerful - Default)") from the dropdown.
   - Optionally, add a custom prompt (e.g., "Character A is female, Character B is male, emphasize a specific tone").

3. **Process Steps**:
   - **Step 1: Summarize Draft**: Click "Start Expansion" to condense the draft (~1-5 mins for 90 pages).
   - **Step 2: Generate Outline**: Click "Continue" to create 6-10 chapter outlines (~1-2 mins).
   - **Step 3: Expand Chapters**: Click "Continue" to expand each chapter (~1-2 mins per chapter). The final chapter includes a climactic ending instruction.
   - Use "Regenerate Summary" to re-summarize with a new prompt.
   - Use "Expand More" to add 500-1000 words to a chapter.
   - Use "Clear Progress" to start over.

4. **Review Results**:
   - View the condensed draft, chapter outlines, and expanded chapters in collapsible sections.
   - The final story is displayed under "Final Expanded Story" once all chapters are expanded.
   - Progress is saved automatically to `localStorage`.

## Project Structure
- **Backend (`server.ts`)**:
  - Handles API endpoints: `/api/summarize-draft`, `/api/generate-outline`, `/api/expand-chapter`, `/api/expand-chapter-more`.
  - Uses OpenAI API with dynamic token parameters (`max_completion_tokens` for GPT-5, `max_tokens` for others).
  - Includes previous chapter context and finale instruction for the last chapter.
  - Retries failed API calls (3 attempts) and falls back to `gpt-4o-mini`.
- **Frontend (`src/components/StoryExpander.tsx`)**:
  - React + TypeScript component with a form for draft input, model selection, and custom prompts.
  - Displays progress bar, condensed draft, chapter outlines, and expanded chapters.
  - Supports resuming progress and further chapter expansions.

## Example Workflow
1. Paste a 90-page novel draft into the textarea.
2. Set a custom prompt: "Character A is female, Character B is male, emphasize a dramatic tone."
3. Select "GPT-5" and click "Start Expansion."
4. After summarization, click "Continue" to generate a 6-10 chapter outline.
5. Click "Continue" to expand each chapter. For Chapter 2+, prior summaries ensure continuity (e.g., Character A’s actions). The final chapter resolves key arcs with a climactic ending.
6. Use "Expand More" to add depth to specific chapters.
7. Review the final story with a cohesive conclusion.

## Notes
- **API Costs**: GPT-5 (~$0.50-2 per chapter), GPT-4o-mini (~$0.10-0.30 per chapter). Check your OpenAI dashboard for usage.
- **Error Handling**: If GPT-5 fails (e.g., empty response), the app retries or falls back to GPT-4o-mini. Check logs (`[Backend]`) for details.
- **Custom Prompts**: Use clear prompts (e.g., "Character A is female") to avoid ambiguity. Chapter-specific prompts can be set via the edit button.
- **Token Limits**: Previous chapter context is capped at ~1000 chars per chapter to stay within GPT-5’s ~128k token limit.
- **Debugging**: If errors occur (e.g., JSON parse issues), check terminal logs and share with custom prompt and a draft snippet.

## Troubleshooting
- **JSON Parse Error**: If the outline fails with "Unexpected end of JSON input," the app retries with a simplified prompt or falls back to GPT-4o-mini. Update `openai` (`npm install openai@latest`) and check API key access.
- **Empty Response**: Verify your OpenAI API key and GPT-5 access in the OpenAI dashboard. Try "GPT-4o-mini" manually.
- **Slow Processing**: For a 90-page draft, summarization may take ~5-15 mins. Test with a 1-2 page snippet if needed.
- **Inconsistent Chapters**: Ensure custom prompts specify character details (e.g., "Character A is female"). The finale instruction should resolve key arcs.

## Future Improvements
- Add a UI to preview/edit previous chapter context.
- Support character profile inputs (e.g., name, gender, role) for upfront consistency.
- Add a manual fallback button for model selection.

## Contributing
Feel free to fork the repo, make changes, and submit pull requests. Report issues or suggest features via GitHub Issues.

## License
MIT License. See `LICENSE` file for details.

---

Built for crafting epic novels with cohesive narratives and climactic endings.

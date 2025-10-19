import React, { useState } from 'react';

interface Chapter {
  title: string;
  summary: string;
  details: string;
}

const StoryExpander: React.FC = () => {
  const [draft, setDraft] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [fullStory, setFullStory] = useState<string>('');
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [error, setError] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;

    setIsLoading(true);
    setError('');
    try {
      const response = await fetch('/api/expand-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draft }),
      });

      if (!response.ok) throw new Error('API request failed');

      const data = await response.json();
      setChapters(data.chapters);
      setFullStory(data.fullStory);
    } catch (err) {
      setError((err as Error).message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Paste Your Initial Draft Here:
        </label>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Enter your story draft (e.g., a short outline about a Sister of Battle's fall to Slaanesh)..."
          className="w-full h-40 p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-vertical"
          required
        />
        <button
          type="submit"
          disabled={isLoading || !draft.trim()}
          className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {isLoading ? 'Expanding...' : 'Expand into Detailed Chapters'}
        </button>
      </form>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          Error: {error}
        </div>
      )}

      {fullStory && (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-2xl font-bold mb-4 text-gray-800">Expanded Story</h2>
          <div
            className="prose max-w-none prose-headings:text-lg prose-headings:font-semibold prose-p:leading-relaxed"
            dangerouslySetInnerHTML={{ __html: fullStory.replace(/\n/g, '<br>').replace(/### /g, '<h3>') }}
          />
        </div>
      )}

      {chapters.length > 0 && (
        <details className="bg-white p-6 rounded-lg shadow-md">
          <summary className="cursor-pointer font-medium text-blue-600 mb-2">View Chapter Breakdown</summary>
          <ul className="space-y-4 mt-4">
            {chapters.map((chapter, idx) => (
              <li key={idx} className="border-l-4 border-blue-500 pl-4">
                <h3 className="font-semibold text-gray-800">{chapter.title}</h3>
                <p className="text-sm text-gray-600 italic mb-2">Summary: {chapter.summary}</p>
                <p className="text-gray-700">{chapter.details.substring(0, 200)}...</p>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
};

export default StoryExpander;

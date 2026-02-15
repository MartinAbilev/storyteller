import React, { useState, useRef } from 'react';
import StoryExpander from './components/StoryExpander';
import SettingsModal from './components/SettingsModal';

function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const storyExpanderRef = useRef<{ saveNow: () => void }>(null);

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      {/* Settings & Print Buttons - Top Right */}
      <div className="fixed top-4 right-4 z-40 no-print flex gap-2">
        <button
          onClick={() => storyExpanderRef.current?.saveNow()}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-3 rounded-lg shadow-md transition-all hover:shadow-lg flex items-center gap-2 border border-blue-700"
          title="Save current state"
        >
          <span className="text-xl">💾</span>
        </button>
        <button
          onClick={() => window.print()}
          className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-all hover:shadow-lg flex items-center gap-2 border border-green-700"
          title="Print / Export to PDF"
        >
          <span className="text-xl">📄</span>
          <span className="hidden sm:inline">Print</span>
        </button>
        <button
          onClick={() => setIsSettingsOpen(true)}
          className="bg-white hover:bg-gray-100 text-gray-700 font-bold py-2 px-4 rounded-lg shadow-md transition-all hover:shadow-lg flex items-center gap-2 border border-gray-200"
          title="Open Settings"
        >
          <span className="text-xl">⚙️</span>
          <span className="hidden sm:inline">Settings</span>
        </button>
      </div>

      {/* Settings Modal */}
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">
          Story Expander: Draft to Detailed Chapters
        </h1>
        <StoryExpander ref={storyExpanderRef} />
      </div>
    </div>
  );
}

export default App;

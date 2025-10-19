import React from 'react';
import StoryExpander from './components/StoryExpander';

function App() {
  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">
          Story Expander: Draft to Detailed Chapters
        </h1>
        <StoryExpander />
      </div>
    </div>
  );
}

export default App;

import React from 'react';
import { KeyElements } from './constants';

interface KeyElementsDisplayProps {
  keyElements: KeyElements | null;
  currentStep: number;
}

export const KeyElementsDisplay: React.FC<KeyElementsDisplayProps> = ({
  keyElements,
  currentStep,
}) => {
  if (!keyElements) return null;

  return (
    <details open={currentStep === 2} className="bg-white p-6 rounded-lg shadow-md">
      <summary className="cursor-pointer font-medium text-blue-600 mb-2">Step 2: Key Elements</summary>
      <div className="space-y-4">
        <h3 className="font-semibold text-gray-800">Characters</h3>
        <ul className="list-disc pl-5">
          {keyElements.characters.map((char, idx) => (
            <li key={idx}>
              {char.name}: {char.gender}, {char.role}, {char.traits}
              {char.affiliations ? `, affiliated with ${char.affiliations}` : ''}
            </li>
          ))}
        </ul>
        <h3 className="font-semibold text-gray-800">Key Events</h3>
        <ul className="list-disc pl-5">
          {keyElements.keyEvents.map((event, idx) => <li key={idx}>{event}</li>)}
        </ul>
        <h3 className="font-semibold text-gray-800">Timeline</h3>
        <ul className="list-disc pl-5">
          {keyElements.timeline.map((time, idx) => <li key={idx}>{time}</li>)}
        </ul>
        <h3 className="font-semibold text-gray-800">Unique Details</h3>
        <ul className="list-disc pl-5">
          {keyElements.uniqueDetails.map((detail, idx) => <li key={idx}>{detail}</li>)}
        </ul>
        <h3 className="font-semibold text-gray-800">Main Story Lines</h3>
        <ul className="list-disc pl-5">
          {keyElements.mainStoryLines.map((line, idx) => <li key={idx}>{line}</li>)}
        </ul>
      </div>
    </details>
  );
};

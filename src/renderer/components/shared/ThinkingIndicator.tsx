import { useState } from 'react';

const PHRASES = [
  'Thinking...',
  'Coming right up...',
  'Noodling...',
  'On it...',
  'Cooking...',
  'Spinning up...',
  'Working on it...',
  'Brewing...',
  'Just a sec...',
  'Hold tight...',
  'Let me cook...',
];

const WAVE_STAGGER_MS = 100;

export function ThinkingIndicator() {
  const [phrase] = useState(() => PHRASES[Math.floor(Math.random() * PHRASES.length)]);
  const totalChars = phrase.length;
  const cycleDuration = totalChars * WAVE_STAGGER_MS + 2800;

  return (
    <span className="text-sm text-text-muted inline-flex" aria-label={phrase}>
      {phrase.split('').map((char, i) => (
        <span
          key={i}
          className="thinking-char-wave"
          style={{
            animationDuration: `${cycleDuration}ms`,
            animationDelay: `${i * WAVE_STAGGER_MS}ms`,
            whiteSpace: char === ' ' ? 'pre' : undefined,
          }}
        >
          {char}
        </span>
      ))}
    </span>
  );
}

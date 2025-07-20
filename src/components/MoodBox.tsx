import React from 'react';
import { useMoodDistribution } from '../hooks/useMoodService';

const MOOD_COLOR_MAP: Record<string, string> = {
  'sad+energetic': 'var(--duke-blue)',
  'sad+calm': 'var(--murrey)',
  'happy+calm': 'var(--folly)',
  'happy+energetic': 'var(--orange-pantone)',
  'Unknown': '#e5e7eb' // Tailwind gray-200 fallback
};

function getMoodKey(mood: string): string {
  if (!mood) return 'Unknown';
  const m = mood.toLowerCase().replace(/\s|and/g, '');
  if (m.includes('sad') && m.includes('energetic')) return 'sad+energetic';
  if (m.includes('sad') && m.includes('calm')) return 'sad+calm';
  if (m.includes('happy') && m.includes('calm')) return 'happy+calm';
  if (m.includes('happy') && m.includes('energetic')) return 'happy+energetic';
  return 'Unknown';
}

function MoodBar({ moods }: { moods: string[] }) {
  const total = moods.length || 1;
  return (
    <div className="flex h-6 w-full rounded overflow-hidden border mt-2">
      {moods.map((mood, i) => {
        const key = getMoodKey(mood);
        return (
          <div
            key={i}
            style={{ backgroundColor: MOOD_COLOR_MAP[key] || MOOD_COLOR_MAP.Unknown, width: `${100 / total}%` }}
            title={mood}
          />
        );
      })}
    </div>
  );
}

const MoodBox = ({ userMood, loading, error }: any) => {
  const { moodDistribution } = useMoodDistribution();
  
  if (loading) return <div className="rounded-lg p-4 bg-blue-100 text-blue-900 shadow flex flex-col items-center">Loading...</div>;
  if (error) return <div className="rounded-lg p-4 bg-blue-100 text-blue-900 shadow flex flex-col items-center">Error: {error}</div>;

  const mood = userMood.user_mood || 'Unknown';
  const moods = moodDistribution.moods || [];
  const moodKey = getMoodKey(mood);

  // Mood legend data
  const MOOD_KEY = [
    { mood: 'Happy + Calm', color: '#ff0054' },
    { mood: 'Happy + Energetic', color: '#ff5400' },
    { mood: 'Sad + Calm', color: '#9e0059' },
    { mood: 'Sad + Energetic', color: '#390099' }
  ];

  return (
    <div className="rounded-lg p-4 bg-blue-100 text-blue-900 shadow flex flex-col items-center h-full">
      <h2 className="text-xl font-semibold text-purple-600 mb-3 text-center">Your Current Mood</h2>
      <div className="text-2xl mb-2">{mood}</div>
      <MoodBar moods={moods || []} />
      
      {/* Mood Color Legend */}
      <div className="mt-4 w-full">
        <h3 className="text-base font-semibold text-center mb-2">Legend</h3>
        <div className="space-y-1">
          {MOOD_KEY.map(({ mood, color }) => (
            <div key={mood} className="flex items-center gap-2 px-2 py-1 rounded text-sm">
              <span className="w-3 h-3 rounded-full border border-gray-400" style={{ backgroundColor: color }}></span>
              <span className="font-medium text-sm text-gray-800">{mood}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MoodBox;

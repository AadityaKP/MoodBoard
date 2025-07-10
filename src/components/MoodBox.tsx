import React from 'react';

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

const MoodBox = ({ userMood, moodDistribution, loading, error }: any) => {
  if (loading) return <div className="rounded-lg p-4 bg-blue-100 text-blue-900 shadow flex flex-col items-center">Loading...</div>;
  if (error) return <div className="rounded-lg p-4 bg-blue-100 text-blue-900 shadow flex flex-col items-center">Error: {error}</div>;

  const mood = userMood.user_mood || 'Unknown';
  const moods = moodDistribution.moods || [];
  const moodKey = getMoodKey(mood);

  return (
    <div className="rounded-lg p-4 bg-blue-100 text-blue-900 shadow flex flex-col items-center">
      <h2 className="text-lg font-bold mb-2">Your Current Mood</h2>
      <div className="text-2xl mb-2">{mood}</div>
      <MoodBar moods={moods || []} />
    </div>
  );
};

export default MoodBox;

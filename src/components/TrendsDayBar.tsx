import React, { useEffect, useState } from 'react';
import axios from 'axios';

const SECTIONS = [
  { key: 'morning', icon: '🌅' },
  { key: 'afternoon', icon: '🌞' },
  { key: 'evening', icon: '🌇' },
  { key: 'night', icon: '🌙' }
];
const MOOD_COLORS = {
  'happy+calm': 'bg-[#ff0054]', // folly
  'happy+energetic': 'bg-[#ff5400]', // orange-pantone
  'sad+calm': 'bg-[#9e0059]', // murrey
  'sad+energetic': 'bg-[#390099]', // duke-blue
  'unknown': 'bg-gray-300',
  '': 'bg-gray-300'
};
const MOOD_KEY = [
  { mood: 'Happy + Calm', color: 'bg-[#ff0054]' },
  { mood: 'Happy + Energetic', color: 'bg-[#ff5400]' },
  { mood: 'Sad + Calm', color: 'bg-[#9e0059]' },
  { mood: 'Sad + Energetic', color: 'bg-[#390099]' }
];

function normalizeMood(mood) {
  return (mood || '').toLowerCase().replace(/\s|\+/g, '').replace('happyandcalm', 'happy+calm').replace('happyandenergetic', 'happy+energetic').replace('sadandcalm', 'sad+calm').replace('sadandenergetic', 'sad+energetic');
}

function getMoodKey(mood) {
  if (typeof mood !== 'string') return 'unknown';
  const m = mood.toLowerCase().replace(/\s|\+/g, '');
  if (m === 'happycalm') return 'happy+calm';
  if (m === 'happyenergetic') return 'happy+energetic';
  if (m === 'sadcalm') return 'sad+calm';
  if (m === 'sadenergetic') return 'sad+energetic';
  return 'unknown';
}

export default function TrendsDayBar({ selectedDay, selectedSection, onSectionHover, onSectionClick }) {
  const [moods, setMoods] = useState({});
  useEffect(() => {
    const fetchDay = async () => {
      const res = await axios.get('/trends/day', { params: { date: selectedDay.toISOString().slice(0, 10) } });
      setMoods(res.data.data || {});
    };
    fetchDay();
  }, [selectedDay]);
  return (
    <div className="flex flex-col items-center">
      <div className="flex flex-col h-64 w-16 justify-between">
        {SECTIONS.map(({ key, icon }) => {
          const moodKey = getMoodKey(moods[key]);
          return (
            <div
              key={key}
              className={`flex-1 flex flex-col items-center justify-center cursor-pointer ${MOOD_COLORS[moodKey] || MOOD_COLORS['unknown']} rounded mb-2 ${selectedSection === key ? 'ring-2 ring-purple-400' : ''}`}
              onMouseEnter={() => onSectionHover(key)}
              onClick={() => onSectionClick(key)}
              title={key}
            >
              <span className="text-2xl">{icon}</span>
            </div>
          );
        })}
      </div>
      {/* Mood Color Key */}
      <div className="flex flex-wrap justify-center mt-4 gap-2">
        {MOOD_KEY.map(({ mood, color }) => (
          <div key={mood} className={`flex items-center gap-1 px-2 py-1 rounded ${color}`}>
            <span className="w-3 h-3 inline-block rounded-full border border-gray-400 mr-1" style={{ background: 'inherit' }}></span>
            <span className="text-xs font-medium">{mood}</span>
          </div>
        ))}
      </div>
    </div>
  );
} 
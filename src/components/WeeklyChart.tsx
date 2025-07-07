import React, { useEffect, useState } from 'react';
import axios from 'axios';

const SECTIONS = ['morning', 'afternoon', 'evening', 'night'];
const SECTION_LABELS = ['Morning', 'Afternoon', 'Evening', 'Night'];
const MOOD_COLORS = {
  'happy+calm': 'bg-[#ff0054]', // folly
  'happy+energetic': 'bg-[#ff5400]', // orange-pantone
  'sad+calm': 'bg-[#9e0059]', // murrey
  'sad+energetic': 'bg-[#390099]', // duke-blue
  'unknown': 'bg-gray-300',
  '': 'bg-gray-300'
};

function getMoodKey(mood) {
  if (typeof mood !== 'string') return 'unknown';
  const m = mood.toLowerCase().replace(/\s|\+/g, '');
  if (m === 'happycalm') return 'happy+calm';
  if (m === 'happyenergetic') return 'happy+energetic';
  if (m === 'sadcalm') return 'sad+calm';
  if (m === 'sadenergetic') return 'sad+energetic';
  return 'unknown';
}

export default function WeeklyChart({ onDayClick, selectedDay }) {
  const [week, setWeek] = useState([]);
  useEffect(() => {
    const fetchWeek = async () => {
      const res = await axios.get('/trends/weekly');
      setWeek(res.data.week || []);
    };
    fetchWeek();
  }, []);

  return (
    <div className="flex flex-col items-center w-full h-full justify-center max-h-full">
      {/* Y-axis labels and bars */}
      <div className="flex w-full h-[32vh] max-h-[90%] items-center justify-center">
        {/* Y-axis labels */}
        <div className="flex flex-col justify-between mr-4 h-full py-2">
          {SECTION_LABELS.map(label => (
            <div key={label} className="h-1/4 flex items-center text-xs font-medium text-gray-700" style={{ minHeight: 20 }}>{label}</div>
          ))}
        </div>
        {/* Bars for each day */}
        <div className="flex-1 flex gap-4 items-end">
          {week.map(dayObj => {
            const isSelected = selectedDay.toISOString().slice(0, 10) === dayObj.day;
            return (
              <div
                key={dayObj.day}
                className={`flex flex-col cursor-pointer rounded-xl shadow-2xl transition-all duration-150 hover:scale-105 ${isSelected ? 'ring-4 ring-purple-400 scale-105' : ''}`}
                onClick={() => onDayClick(new Date(dayObj.day))}
                title={dayObj.day}
                style={{ minWidth: 32 }}
              >
                {SECTIONS.map((section, i) => {
                  const moodKey = getMoodKey(dayObj.sections[section]);
                  return (
                    <div
                      key={section}
                      className={`w-8 h-12 ${MOOD_COLORS[moodKey] || MOOD_COLORS['unknown']} flex items-center justify-center`}
                      style={{ minHeight: 32, borderTopLeftRadius: i === 0 ? 8 : 0, borderTopRightRadius: i === 0 ? 8 : 0, borderBottomLeftRadius: i === SECTIONS.length - 1 ? 8 : 0, borderBottomRightRadius: i === SECTIONS.length - 1 ? 8 : 0 }}
                    ></div>
                  );
                })}
                {/* X-axis label (day of week and day of month) */}
                <span className={`text-xs mt-1 text-center ${isSelected ? 'font-bold text-purple-700' : ''}`}>{dayObj.dayOfWeek}<br />{dayObj.day.slice(8, 10)}</span>
              </div>
            );
          })}
        </div>
      </div>
      {/* Move X-axis label closer to bars */}
      <div className="flex justify-center w-full mt-1">
        <span className="text-xs text-gray-500">Day of Week</span>
      </div>
    </div>
  );
} 
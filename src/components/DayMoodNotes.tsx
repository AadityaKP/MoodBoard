import { useState, useMemo } from 'react';
import { useDailyMoods, useDailyNotes, useMoodLoading, useMoodError } from '../hooks/useMoodService';

interface DayMoodNotesProps {
  selectedDay: Date;
}

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

const COLORS = ['bg-yellow-200', 'bg-green-200', 'bg-pink-200', 'bg-blue-200'];

function normalizeMood(mood: string) {
  return (mood || '').toLowerCase().replace(/\s|\+/g, '').replace('happyandcalm', 'happy+calm').replace('happyandenergetic', 'happy+energetic').replace('sadandcalm', 'sad+calm').replace('sadandenergetic', 'sad+energetic');
}

function getMoodKey(mood: string) {
  if (typeof mood !== 'string') return 'unknown';
  const m = mood.toLowerCase().replace(/\s|\+/g, '');
  if (m === 'happycalm') return 'happy+calm';
  if (m === 'happyenergetic') return 'happy+energetic';
  if (m === 'sadcalm') return 'sad+calm';
  if (m === 'sadenergetic') return 'sad+energetic';
  return 'unknown';
}

function toDDMMYYYY(date: Date) {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

export default function DayMoodNotes({ 
  selectedDay 
}: DayMoodNotesProps) {
  const { dailyMoods } = useDailyMoods();
  const { dailyNotes } = useDailyNotes();
  const { loading } = useMoodLoading();
  const { error } = useMoodError();
  const [selectedSection, setSelectedSection] = useState<string | null>(null);

  // Note: Daily data refresh is now handled by the parent component
  // when selectedDay changes, so we don't need to call it here

  // Helper function to split notes by | and format them
  const formatNotes = useMemo(() => {
    return (notesText: string): string[] => {
      if (!notesText || notesText.trim() === '') {
        return ['No notes'];
      }
      const notesArray = notesText.split('|').map(note => note.trim()).filter(note => note);
      return notesArray.length > 0 ? notesArray : ['No notes'];
    };
  }, []);

  // Process notes data with useMemo to prevent infinite re-renders
  const notes = useMemo(() => {
    const notesArr = Array.isArray(dailyNotes.notes) ? dailyNotes.notes : [];
    const notesBySection: Record<string, string> = {};
    for (const section of SECTIONS.map(s => s.key)) {
      const found = notesArr.find((n: any) => (n.time || n['Time of Day'] || '').toLowerCase() === section);
      notesBySection[section] = found ? found.note : '';
    }
    return notesBySection;
  }, [dailyNotes.notes]);

  if (loading) {
    return (
      <div className="bg-white/80 rounded-xl shadow-lg p-4 border border-purple-200 h-full">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded mb-4"></div>
          <div className="space-y-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white/80 rounded-xl shadow-lg p-4 border border-purple-200 h-full">
        <div className="text-red-500 text-center">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="bg-white/80 rounded-xl shadow-lg p-4 border border-purple-200 h-[500px]">
      <h2 className="text-xl font-semibold text-purple-600 mb-3 text-center">
        Your Notes
      </h2>
      
      <div className="flex flex-col h-full">
        {/* 2x2 Grid Layout */}
        <div className="h-80 grid grid-cols-2 gap-3 p-1">
          {SECTIONS.map((section, i) => {
            const moodKey = getMoodKey(dailyMoods.data[section.key]);
            return (
              <div
                key={section.key}
                className={`${COLORS[i]} rounded-lg shadow-md p-3 flex flex-col cursor-pointer transition-all duration-200 hover:shadow-lg ${selectedSection === section.key ? 'ring-2 ring-purple-400' : ''}`}
                onMouseEnter={() => setSelectedSection(section.key)}
                onMouseLeave={() => setSelectedSection(null)}
              >
                {/* Mood Color Bar */}
                <div className={`w-full h-1 rounded-full mb-1 ${MOOD_COLORS[moodKey] || MOOD_COLORS['unknown']}`}></div>
                
                {/* Section Title */}
                <div className="font-bold capitalize text-base mb-1 text-gray-800">
                  {section.key}
                </div>
                
                {/* Notes Content */}
                <div className="flex-1 text-base text-gray-700 overflow-hidden leading-relaxed">
                  {formatNotes(notes[section.key]).map((note, index) => (
                    <div key={index} className="mb-1">{note}</div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
} 
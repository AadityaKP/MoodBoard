import { useState } from 'react';

interface UserMood {
  user_mood: string;
  date: string;
  day: string;
  time: string;
}

interface ReflectionsDayMoodNotesProps {
  selectedDay: Date;
  userMood: UserMood;
  loading: boolean;
  error: string | null;
}

export default function ReflectionsDayMoodNotes({ 
  selectedDay, 
  userMood, 
  loading, 
  error 
}: ReflectionsDayMoodNotesProps) {
  const [reflection, setReflection] = useState('');
  const [moodNotes, setMoodNotes] = useState('');
  const [savedReflections, setSavedReflections] = useState<Array<{date: string, text: string}>>([]);
  const [savedMoodNotes, setSavedMoodNotes] = useState<Array<{date: string, text: string}>>([]);

  const handleSaveReflection = () => {
    if (reflection.trim()) {
      const newReflection = {
        date: selectedDay.toDateString(),
        text: reflection
      };
      setSavedReflections([...savedReflections, newReflection]);
      setReflection('');
    }
  };

  const handleSaveMoodNote = () => {
    if (moodNotes.trim()) {
      const newMoodNote = {
        date: selectedDay.toDateString(),
        text: moodNotes
      };
      setSavedMoodNotes([...savedMoodNotes, newMoodNote]);
      setMoodNotes('');
    }
  };

  const selectedDayReflections = savedReflections.filter(r => r.date === selectedDay.toDateString());
  const selectedDayMoodNotes = savedMoodNotes.filter(n => n.date === selectedDay.toDateString());

  if (loading) {
    return (
      <div className="bg-white/80 rounded-xl shadow-lg p-4 border border-purple-200 h-full">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded mb-4"></div>
          <div className="h-20 bg-gray-200 rounded mb-4"></div>
          <div className="h-4 bg-gray-200 rounded mb-4"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
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
    <div className="bg-white/80 rounded-xl shadow-lg p-3 border border-purple-200 h-full flex flex-col">
      <h2 className="text-lg font-semibold text-purple-600 mb-3 text-center">
        Reflections & Notes
      </h2>
      
      <div className="flex-1 flex flex-col space-y-3">
        {/* Reflections Section */}
        <div className="flex-1">
          <h3 className="text-sm font-medium text-purple-600 mb-2">Daily Reflection</h3>
          <textarea
            value={reflection}
            onChange={(e) => setReflection(e.target.value)}
            placeholder="How are you feeling today? What's on your mind?"
            className="w-full h-20 p-2 text-sm border border-purple-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-purple-300"
          />
          <button
            onClick={handleSaveReflection}
            className="mt-2 px-3 py-1 bg-purple-500 text-white text-xs rounded-lg hover:bg-purple-600 transition-colors"
          >
            Save Reflection
          </button>
          
          {/* Saved Reflections */}
          {selectedDayReflections.length > 0 && (
            <div className="mt-3">
              <h4 className="text-xs font-medium text-gray-600 mb-2">Today's Reflections:</h4>
              {selectedDayReflections.map((ref, index) => (
                <div key={index} className="text-xs text-gray-700 bg-purple-50 p-2 rounded mb-1">
                  {ref.text}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Day Mood Notes Section */}
        <div className="flex-1">
          <h3 className="text-sm font-medium text-purple-600 mb-2">Mood Notes</h3>
          <textarea
            value={moodNotes}
            onChange={(e) => setMoodNotes(e.target.value)}
            placeholder="Quick mood notes, triggers, or observations..."
            className="w-full h-20 p-2 text-sm border border-purple-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-purple-300"
          />
          <button
            onClick={handleSaveMoodNote}
            className="mt-2 px-3 py-1 bg-blue-500 text-white text-xs rounded-lg hover:bg-blue-600 transition-colors"
          >
            Save Note
          </button>
          
          {/* Saved Mood Notes */}
          {selectedDayMoodNotes.length > 0 && (
            <div className="mt-3">
              <h4 className="text-xs font-medium text-gray-600 mb-2">Today's Notes:</h4>
              {selectedDayMoodNotes.map((note, index) => (
                <div key={index} className="text-xs text-gray-700 bg-blue-50 p-2 rounded mb-1">
                  {note.text}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 
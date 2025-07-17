import { useState } from 'react';
import axios from 'axios';
import { useMoodService } from '../hooks/useMoodService';

interface ReflectionsProps {
  selectedDay: Date;
}

const TIME_SLOTS = [
  { value: 'morning', label: 'Morning' },
  { value: 'afternoon', label: 'Afternoon' },
  { value: 'evening', label: 'Evening' },
  { value: 'night', label: 'Night' }
];

export default function Reflections({ selectedDay }: ReflectionsProps) {
  const [reflection, setReflection] = useState('');
  const [selectedTimeSlot, setSelectedTimeSlot] = useState('morning');
  const [isSaving, setIsSaving] = useState(false);
  const { refreshDailyData } = useMoodService();

  const handleSaveReflection = async () => {
    if (!reflection.trim()) return;

    setIsSaving(true);
    try {
      // Format date as YYYY-MM-DD
      const year = selectedDay.getFullYear();
      const month = String(selectedDay.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDay.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      await axios.post('/reflections', {
        reflection: reflection.trim(),
        date: dateStr,
        timeSlot: selectedTimeSlot
      });

      // Clear the form
      setReflection('');
      
      // Refresh daily data to show the new reflection
      refreshDailyData(dateStr);
      
      console.log('Reflection saved successfully');
    } catch (error) {
      console.error('Error saving reflection:', error);
      alert('Failed to save reflection. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white/80 rounded-xl shadow-lg p-3 border border-purple-200 mb-2 h-full">
      <h2 className="text-lg font-semibold text-purple-600 mb-3 text-center">
        Daily Reflection
      </h2>
      
      <div className="space-y-3">
        {/* Time Slot Selector */}
        <div className="flex flex-wrap gap-1">
          {TIME_SLOTS.map(slot => (
            <button
              key={slot.value}
              onClick={() => setSelectedTimeSlot(slot.value)}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                selectedTimeSlot === slot.value
                  ? 'bg-purple-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {slot.label}
            </button>
          ))}
        </div>

        <textarea
          value={reflection}
          onChange={(e) => setReflection(e.target.value)}
          placeholder={`How are you feeling this ${selectedTimeSlot}? What's on your mind?`}
          className="w-full h-20 p-2 text-sm border border-purple-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-purple-300"
        />
        
        <button
          onClick={handleSaveReflection}
          disabled={isSaving || !reflection.trim()}
          className={`w-full px-3 py-2 text-sm rounded-lg transition-colors ${
            isSaving || !reflection.trim()
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-purple-500 text-white hover:bg-purple-600'
          }`}
        >
          {isSaving ? 'Saving...' : 'Save Reflection'}
        </button>
      </div>
    </div>
  );
} 
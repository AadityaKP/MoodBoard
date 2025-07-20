import React, { useEffect, useState } from 'react';
import { useMoodService } from '../hooks/useMoodService';
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
  const { loading, weeklyTrends, refreshWeeklyTrends, userMood } = useMoodService();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Use the weeklyTrends from mood service instead of local state
  const week = weeklyTrends?.week || [];
  
  // Debug logging
  console.log('WeeklyChart - weeklyTrends:', weeklyTrends);
  console.log('WeeklyChart - week data:', week);
  console.log('WeeklyChart - userMood:', userMood);

  // Refresh weekly data when selectedDay changes or when user mood updates
  useEffect(() => {
    if (selectedDay) {
      const refreshData = async () => {
        try {
          setIsRefreshing(true);
          // Use local date formatting to avoid timezone issues
          const year = selectedDay.getFullYear();
          const month = String(selectedDay.getMonth() + 1).padStart(2, '0');
          const day = String(selectedDay.getDate()).padStart(2, '0');
          const dateStr = `${year}-${month}-${day}`;
          console.log('Refreshing weekly data for date:', dateStr);
          await refreshWeeklyTrends(dateStr);
        } catch (error) {
          console.error('Error refreshing weekly data:', error);
        } finally {
          setIsRefreshing(false);
        }
      };
      
      refreshData();
    }
  }, [selectedDay, refreshWeeklyTrends, userMood]); // Added userMood as dependency

  // Calculate week range for display
  const getWeekRange = () => {
    if (week.length === 0) return '';
    const startDate = new Date(week[0].day);
    const endDate = new Date(week[6].day);
    const startStr = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endStr = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${startStr} - ${endStr}`;
  };

  if (loading || isRefreshing) {
    return (
      <div className="space-y-2 w-full h-full flex flex-col justify-center">
        <div className="text-center text-xs text-gray-500 mb-2">
          {isRefreshing ? 'Updating weekly data...' : 'Loading weekly data...'}
        </div>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded mb-2"></div>
          <div className="h-4 bg-gray-200 rounded mb-2"></div>
          <div className="h-4 bg-gray-200 rounded mb-2"></div>
          <div className="h-4 bg-gray-200 rounded mb-2"></div>
          <div className="h-4 bg-gray-200 rounded mb-2"></div>
          <div className="h-4 bg-gray-200 rounded mb-2"></div>
          <div className="h-4 bg-gray-200 rounded mb-2"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-hidden p-3">
      {/* Week range header */}
      <div className="text-center text-xs text-gray-500 mb-2">
        {getWeekRange()}
      </div>
      
      {/* Chart container with fixed height */}
      <div className="h-[calc(100%-2rem)] overflow-y-auto">
        {/* Header row with time periods */}
        <div className="flex items-center mb-1">
          <div className="w-16 text-xs font-medium text-gray-600">Day</div>
          {SECTIONS.map(section => (
            <div key={section} className="flex-1 text-xs font-medium text-gray-600 text-center capitalize">
              {section}
            </div>
          ))}
        </div>
        
        {/* Data rows */}
        {week.map(dayObj => {
          const dayName = new Date(dayObj.day).toLocaleDateString('en-US', { weekday: 'short' });
          const dayDate = new Date(dayObj.day).getDate();
          // Use local date formatting for comparison to avoid timezone issues
          const selectedDateStr = `${selectedDay.getFullYear()}-${String(selectedDay.getMonth() + 1).padStart(2, '0')}-${String(selectedDay.getDate()).padStart(2, '0')}`;
          const isSelected = selectedDateStr === dayObj.day;
          
          return (
            <div
              key={dayObj.day}
              className={`flex items-center cursor-pointer rounded p-1 mb-1 ${isSelected ? 'ring-2 ring-purple-400 bg-purple-50' : 'hover:bg-gray-50'}`}
              onClick={() => onDayClick(new Date(dayObj.day))}
            >
              <div className={`w-16 text-xs font-medium ${isSelected ? 'text-purple-600' : 'text-gray-700'}`}>
                {dayName} {dayDate}
              </div>
              {SECTIONS.map(section => {
                const moodKey = getMoodKey(dayObj.sections[section]);
                return (
                  <div
                    key={section}
                    className={`flex-1 h-6 mx-1 rounded ${MOOD_COLORS[moodKey] || MOOD_COLORS['unknown']}`}
                    title={`${section}: ${dayObj.sections[section] || 'Unknown'}`}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
} 
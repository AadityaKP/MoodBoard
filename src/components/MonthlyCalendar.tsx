import React, { useEffect, useState } from 'react';
import { useMoodService } from '../hooks/useMoodService';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getDaysInMonth(year: number, month: number) {
  // month is 0-based
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  
  // Create array with empty slots for days before the first day of the month
  const days = [];
  
  // Add empty slots for days before the first day of the month
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(null);
  }
  
  // Add all days of the month
  for (let i = 1; i <= daysInMonth; i++) {
    const date = new Date(year, month, i);
    days.push(date);
  }
  
  return days;
}

function formatDateForDisplay(date: Date): string {
  // Use local date formatting to avoid timezone issues
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isToday(date: Date): boolean {
  const today = new Date();
  return date.getDate() === today.getDate() &&
         date.getMonth() === today.getMonth() &&
         date.getFullYear() === today.getFullYear();
}

function isSameDay(date1: Date, date2: Date): boolean {
  return date1.getDate() === date2.getDate() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getFullYear() === date2.getFullYear();
}

interface MonthlyCalendarProps {
  onDaySelect: (date: Date) => void;
  selectedDay: Date;
}

export default function MonthlyCalendar({ onDaySelect, selectedDay }: MonthlyCalendarProps) {
  const { refreshDailyData } = useMoodService();
  const [currentMonth, setCurrentMonth] = useState(() => {
    // Initialize to today's month if selectedDay is not today
    const today = new Date();
    if (!isSameDay(selectedDay, today)) {
      return today.getMonth();
    }
    return selectedDay.getMonth();
  });
  const [currentYear, setCurrentYear] = useState(() => {
    // Initialize to today's year if selectedDay is not today
    const today = new Date();
    if (!isSameDay(selectedDay, today)) {
      return today.getFullYear();
    }
    return selectedDay.getFullYear();
  });

  // Update calendar view when selectedDay changes
  useEffect(() => {
    setCurrentMonth(selectedDay.getMonth());
    setCurrentYear(selectedDay.getFullYear());
  }, [selectedDay]);

  const days = getDaysInMonth(currentYear, currentMonth);

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(y => y - 1);
    } else {
      setCurrentMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(y => y + 1);
    } else {
      setCurrentMonth(m => m + 1);
    }
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCurrentYear(Number(e.target.value));
  };

  const handleDayClick = (date: Date) => {
    onDaySelect(date);
    // Refresh daily data for the selected date
    refreshDailyData(formatDateForDisplay(date));
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentMonth(today.getMonth());
    setCurrentYear(today.getFullYear());
    onDaySelect(today);
    refreshDailyData(formatDateForDisplay(today));
  };

  return (
    <div className="rounded-lg p-2 bg-gray-100 text-gray-900 shadow w-64 text-sm">
      {/* Header with month/year and navigation */}
      <div className="flex items-center justify-between mb-2">
        <button 
          onClick={handlePrevMonth} 
          className="px-2 py-1 rounded hover:bg-gray-200 transition-colors"
          title="Previous month"
        >
          &#8592;
        </button>
        <span className="font-bold text-base">{MONTHS[currentMonth]} {currentYear}</span>
        <button 
          onClick={handleNextMonth} 
          className="px-2 py-1 rounded hover:bg-gray-200 transition-colors"
          title="Next month"
        >
          &#8594;
        </button>
      </div>

      {/* Year selector and Today button */}
      <div className="mb-2 flex justify-between items-center">
        <select 
          value={currentYear} 
          onChange={handleYearChange} 
          className="border rounded px-1 py-0.5 text-xs"
        >
          {Array.from({ length: 10 }, (_, i) => currentYear - 5 + i).map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <button 
          onClick={goToToday}
          className="px-2 py-0.5 text-xs bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors"
          title="Go to today"
        >
          Today
        </button>
      </div>

      {/* Days of week header */}
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {DAYS_OF_WEEK.map(day => (
          <div key={day} className="h-6 flex items-center justify-center text-xs font-medium text-gray-600">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((date, index) => {
          if (!date) {
            return (
              <div key={`empty-${index}`} className="h-7 w-7 flex items-center justify-center">
                {/* Empty space */}
              </div>
            );
          }

          const isSelected = isSameDay(date, selectedDay);
          const isTodayDate = isToday(date);
          const isCurrentMonth = date.getMonth() === currentMonth;

          return (
            <div
              key={formatDateForDisplay(date)}
              className={`h-7 w-7 flex items-center justify-center rounded cursor-pointer text-xs transition-colors ${
                isSelected 
                  ? 'bg-purple-500 text-white font-bold' 
                  : isTodayDate 
                    ? 'bg-purple-200 text-purple-800 font-bold border-2 border-purple-400'
                    : isCurrentMonth
                      ? 'bg-white hover:bg-gray-200 text-gray-900'
                      : 'bg-gray-100 text-gray-400'
              }`}
              onClick={() => handleDayClick(date)}
              title={`${date.toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}${isTodayDate ? ' (Today)' : ''}`}
            >
              {date.getDate()}
            </div>
          );
        })}
      </div>
    </div>
  );
} 
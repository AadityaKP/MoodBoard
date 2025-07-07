import React, { useEffect, useState } from 'react';
import axios from 'axios';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function getDaysInMonth(year, month) {
  // month is 0-based
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, i) => {
    const d = new Date(year, month, i + 1);
    return d.toISOString().slice(0, 10);
  });
}

export default function MonthlyCalendar({ onDaySelect, selectedDay }) {
  const [month, setMonth] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(selectedDay.getMonth());
  const [currentYear, setCurrentYear] = useState(selectedDay.getFullYear());

  useEffect(() => {
    const fetchMonth = async () => {
      // Always show all days for the selected month/year
      setMonth(getDaysInMonth(currentYear, currentMonth));
    };
    fetchMonth();
  }, [currentMonth, currentYear]);

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
  const handleYearChange = (e) => {
    setCurrentYear(Number(e.target.value));
  };

  return (
    <div className="rounded-lg p-2 bg-gray-100 text-gray-900 shadow w-64 text-sm">
      <div className="flex items-center justify-between mb-1">
        <button onClick={handlePrevMonth} className="px-1">&#8592;</button>
        <span className="font-bold text-base">{MONTHS[currentMonth]} {currentYear}</span>
        <button onClick={handleNextMonth} className="px-1">&#8594;</button>
      </div>
      <div className="mb-1 flex justify-center">
        <select value={currentYear} onChange={handleYearChange} className="border rounded px-1 py-0.5 text-xs">
          {Array.from({ length: 10 }, (_, i) => currentYear - 5 + i).map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {month.map(dayStr => (
          <div
            key={dayStr}
            className={`h-7 w-7 flex items-center justify-center rounded cursor-pointer text-xs ${selectedDay.toISOString().slice(0, 10) === dayStr ? 'bg-purple-300' : 'bg-white'}`}
            onClick={() => onDaySelect(new Date(dayStr))}
            title={dayStr}
          >
            {parseInt(dayStr.split('-')[2], 10)}
          </div>
        ))}
      </div>
    </div>
  );
} 
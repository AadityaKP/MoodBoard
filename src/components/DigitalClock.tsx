import { useState, useEffect } from 'react';

export default function DigitalClock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getTimeOfDay = (date: Date) => {
    const hours = date.getHours();
    if (hours >= 6 && hours < 12) return 'morning';
    if (hours >= 12 && hours < 17) return 'afternoon';
    if (hours >= 17 && hours < 21) return 'evening';
    return 'night';
  };

  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-md p-3 border border-purple-200">
      <h2 className="text-xl font-semibold text-purple-600 mb-1 text-center">
        Clock
      </h2>
      <div className="text-center">
        <div className="text-2xl font-bold text-purple-600 font-mono">
          {formatTime(time)}
        </div>
        <div className="text-base font-medium text-purple-500 capitalize">
          {getTimeOfDay(time)}
        </div>
        <div className="text-lg font-semibold text-purple-700 mt-2">
          {formatDate(time)}
        </div>
      </div>
    </div>
  );
} 
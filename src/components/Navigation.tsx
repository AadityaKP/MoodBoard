import { useState, useEffect } from 'react';

interface SpotifyUser {
  id: string;
  display_name: string;
  images: Array<{ url: string }>;
}

interface NavigationProps {
  user: SpotifyUser | null;
  date: string;
  day: string;
  time: string;
}

export default function Navigation({ user, date, day, time }: NavigationProps) {
  return (
    <nav className="flex items-center justify-between px-6 py-3 bg-white/90 backdrop-blur-sm shadow-lg rounded-xl mb-4">
      <div className="text-xl font-bold text-purple-700">MoodBoard</div>
      
      {/* Centered Date/Time Info */}
      <div className="flex items-center space-x-4 text-sm text-gray-600">
        <span className="font-medium">{date}</span>
        <span className="text-purple-500">•</span>
        <span className="font-medium">{day}</span>
        <span className="text-purple-500">•</span>
        <span className="font-medium">{time}</span>
      </div>
      
      {/* Spotify User Info */}
      <div className="flex items-center space-x-3">
        {user ? (
          <>
            <div className="text-right">
              <div className="text-sm font-medium text-gray-900">{user.display_name}</div>
              <div className="text-xs text-gray-500">Spotify User</div>
            </div>
            {user.images && user.images[0] && (
              <img 
                src={user.images[0].url} 
                alt={user.display_name}
                className="w-8 h-8 rounded-full border-2 border-purple-200"
              />
            )}
          </>
        ) : (
          <div className="text-sm text-gray-500">Not connected to Spotify</div>
        )}
      </div>
    </nav>
  );
}

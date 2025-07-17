import React from 'react';

export default function GifBox() {
  return (
    <div className="bg-white/80 rounded-xl shadow-lg p-3 border border-purple-200 h-32">
      <div className="h-full flex items-center justify-center">
        <img 
          src="/CSVS/3483-mountainz.gif" 
          alt="Mountain Animation"
          className="w-full h-full object-cover rounded-lg"
        />
      </div>
    </div>
  );
} 
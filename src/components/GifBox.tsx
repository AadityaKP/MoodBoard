import React from 'react';

const GifBox: React.FC = () => {
  return (
    <div className="bg-white/80 rounded-xl shadow-lg p-3 border border-purple-200 h-full flex flex-col">
      <h2 className="text-xl font-semibold text-purple-600 mb-3 text-center">Mood Visual</h2>
      <div className="flex-1 flex items-center justify-center">
        <img 
          src="/CSVS/3483-mountainz.gif" 
          alt="Mood visualization"
          className="max-w-full max-h-full rounded-lg shadow-md"
          style={{ objectFit: 'contain' }}
        />
      </div>
      <div className="text-center mt-2">
        <p className="text-sm text-gray-600">Let your mood flow like the mountains</p>
      </div>
    </div>
  );
};

export default GifBox; 
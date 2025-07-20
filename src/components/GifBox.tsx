import React from 'react';

export default function GifBox() {
  return (
    <div className="bg-white/80 rounded-xl shadow-lg p-3 border border-purple-200 aspect-square">
      <div className="h-full flex items-center justify-center">
        <img 
          src="/CSVS/warmer_days___lofi_cat__good_mood_lofi_hip_hop_mix___.gif" 
          alt="Mountain Animation"
          className="w-full h-full object-cover rounded-lg"
        />
      </div>
    </div>
  );
} 
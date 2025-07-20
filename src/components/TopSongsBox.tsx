import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTopSongs, useMoodService } from '../hooks/useMoodService';

const TopSongsBox = ({ userMood, loading, error }: any) => {
  const { topSongs } = useTopSongs();
  // Removed debug code: no need to get currentUserMood for debug

  if (loading) return <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-xl"><CardHeader><CardTitle>Loading...</CardTitle></CardHeader></Card>;
  if (error) return <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-xl"><CardHeader><CardTitle>Error: {error}</CardTitle></CardHeader></Card>;

  return (
    <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-xl h-[391px]">
      <CardHeader>
        <CardTitle className="text-xl font-semibold text-purple-600 mb-3 text-center">Your Top {userMood.user_mood} Songs</CardTitle>
      </CardHeader>
      <CardContent className="h-[311px] flex flex-col">
        <div className="space-y-2 flex-1">
          {topSongs.songs && topSongs.songs.length === 0 ? (
            <div className="text-gray-500 text-center flex items-center justify-center h-full">
              <p>No songs found for this mood.</p>
            </div>
          ) : (
            <>
              {(topSongs.songs || []).map((song: any, i: number) => (
                <div key={i} className="flex items-center">
                  <span className="text-lg font-bold text-purple-700 w-6">{i + 1}.</span>
                  <span className="text-sm text-gray-700">{song.title}</span>
                </div>
              ))}
              {/* Fill remaining space with placeholder items if less than 5 songs */}
              {Array.from({ length: Math.max(0, 5 - (topSongs.songs?.length || 0)) }).map((_, i) => (
                <div key={`placeholder-${i}`} className="flex items-center opacity-30">
                  <span className="text-lg font-bold text-gray-400 w-6">{((topSongs.songs?.length || 0) + i + 1)}.</span>
                  <div className="h-4 bg-gray-200 rounded w-32 animate-pulse"></div>
                </div>
              ))}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default TopSongsBox;

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const TopSongsBox = ({ userMood, topSongs, loading, error }: any) => {
  if (loading) return <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-xl"><CardHeader><CardTitle>Loading...</CardTitle></CardHeader></Card>;
  if (error) return <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-xl"><CardHeader><CardTitle>Error: {error}</CardTitle></CardHeader></Card>;

  return (
    <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-xl">
      <CardHeader>
        <CardTitle className="text-xl font-semibold">Your Top {userMood.user_mood} Songs</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {topSongs.songs && topSongs.songs.length === 0 ? (
            <div className="text-gray-500">No songs found for this mood.</div>
          ) : (
            (topSongs.songs || []).map((song: any, i: number) => (
              <div key={i} className="flex items-center space-x-3 p-2 rounded-lg">
                <div className="w-8 h-8 flex items-center justify-center">
                  <span className="text-lg font-bold text-purple-700">{i + 1}</span>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">{song.title}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default TopSongsBox;

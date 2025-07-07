import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboardData } from '../hooks/useDashboardData';

const TopSongsBox = () => {
  const { userMood } = useDashboardData();
  const [topSongs, setTopSongs] = useState<{ title: string; artist: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTopSongs() {
      setLoading(true);
      setError(null);
      try {
        const mood = encodeURIComponent(userMood.user_mood || '');
        const res = await fetch(`/top-songs?mood=${mood}`);
        if (!res.ok) throw new Error('Failed to fetch top songs');
        const data = await res.json();
        setTopSongs(data.songs || []);
      } catch (e: any) {
        setError(e.message || 'Failed to load top songs');
      }
      setLoading(false);
    }
    if (userMood.user_mood) {
      fetchTopSongs();
    }
  }, [userMood.user_mood]);

  if (loading) return <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-xl"><CardHeader><CardTitle>Loading...</CardTitle></CardHeader></Card>;
  if (error) return <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-xl"><CardHeader><CardTitle>Error: {error}</CardTitle></CardHeader></Card>;

  return (
    <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-xl">
      <CardHeader>
        <CardTitle className="text-xl font-semibold">Your Top {userMood.user_mood} Songs</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {topSongs.length === 0 ? (
            <div className="text-gray-500">No songs found for this mood.</div>
          ) : (
            topSongs.map((song, i) => (
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

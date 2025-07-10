import { useEffect, useState } from 'react';
import axios from 'axios';

export interface MoodRecord {
  date: string;
  day: string;
  time: string;
  mood: string;
}

export interface ReflectionRecord {
  date: string;
  day: string;
  time: string;
  note: string;
}

export interface SongRecord {
  title: string;
  artist: string;
}

export interface TrendRecord {
  date: string;
  summary: string;
  moods: Record<string, number>;
}

export interface DashboardData {
  userMood: { user_mood: string; date: string; day: string; time: string };
  moodDistribution: { moods: string[]; records: MoodRecord[] };
  suggestions: { mood: string; suggestions: string[] };
  topSongs: { mood: string; songs: SongRecord[] };
  weeklyTrends: { trends: TrendRecord[] };
  reflections: { reflections: ReflectionRecord[] };
  loading: boolean;
  error: string | null;
}

export function useDashboardData(): DashboardData & { refresh: () => void } {
  const [data, setData] = useState<DashboardData>({
    userMood: { user_mood: '', date: '', day: '', time: '' },
    moodDistribution: { moods: [], records: [] },
    suggestions: { mood: '', suggestions: [] },
    topSongs: { mood: '', songs: [] },
    weeklyTrends: { trends: [] },
    reflections: { reflections: [] },
    loading: true,
    error: null,
  });

  const fetchAll = async () => {
    setData(d => ({ ...d, loading: true }));
    try {
      // Fetch user mood first
      const userMoodRes = await axios.get('/user-mood');
      const userMood = userMoodRes.data;
      // Use the full user mood string for top songs
      const moodParam = encodeURIComponent(userMood.user_mood || '');
      const [moodDistribution, suggestions, topSongs, weeklyTrends, reflections] = await Promise.all([
        axios.get('/mood-distribution'),
        axios.get('/suggestions'),
        axios.get(`/top-songs?mood=${moodParam}`),
        axios.get('/weekly-trends'),
        axios.get('/reflections'),
      ]);
      setData({
        userMood,
        moodDistribution: moodDistribution.data,
        suggestions: suggestions.data,
        topSongs: topSongs.data,
        weeklyTrends: weeklyTrends.data,
        reflections: reflections.data,
        loading: false,
        error: null,
      });
    } catch (e: any) {
      setData(d => ({ ...d, loading: false, error: e.message || 'Failed to load dashboard data' }));
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  return { ...data, refresh: fetchAll };
} 
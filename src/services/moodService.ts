import axios from 'axios';
import { moodEventService, MOOD_EVENTS } from './moodEventService';

// Types
export interface UserMood {
  user_mood: string;
  date: string;
  day: string;
  time: string;
}

export interface WeeklyTrend {
  trends: Array<{
    date: string;
    summary: string;
    moods: Record<string, number>;
  }>;
}

export interface DailyMoodData {
  data: Record<string, string>;
}

export interface DailyNotesData {
  notes: Array<{
    time?: string;
    'Time of Day'?: string;
    note: string;
  }>;
}

export interface MoodDistribution {
  [key: string]: number;
}

export interface Suggestions {
  mood: string;
  suggestions: string[];
}

export interface TopSongs {
  [key: string]: any[];
}

export interface MoodState {
  userMood: UserMood;
  weeklyTrends: WeeklyTrend;
  dailyMoods: DailyMoodData;
  dailyNotes: DailyNotesData;
  moodDistribution: MoodDistribution;
  suggestions: Suggestions;
  topSongs: TopSongs;
  loading: boolean;
  error: string | null;
  lastUpdate: number;
}

// Initial state
const initialState: MoodState = {
  userMood: {
    user_mood: '',
    date: '',
    day: '',
    time: ''
  },
  weeklyTrends: { trends: [] },
  dailyMoods: { data: {} },
  dailyNotes: { notes: [] },
  moodDistribution: {},
  suggestions: { mood: '', suggestions: [] },
  topSongs: {},
  loading: false,
  error: null,
  lastUpdate: 0
};

class MoodService {
  private static instance: MoodService;
  private state: MoodState = { ...initialState };
  private subscribers: Set<(state: MoodState) => void> = new Set();
  private autoRefreshInterval: NodeJS.Timeout | null = null;

  private constructor() {
    // Start auto-refresh every 30 seconds
    this.startAutoRefresh();
  }

  public static getInstance(): MoodService {
    if (!MoodService.instance) {
      MoodService.instance = new MoodService();
    }
    return MoodService.instance;
  }

  // Get current state
  public getState(): MoodState {
    return { ...this.state };
  }

  // Subscribe to state changes
  public subscribe(callback: (state: MoodState) => void): () => void {
    this.subscribers.add(callback);
    
    // Immediately call with current state
    callback(this.getState());
    
    // Return unsubscribe function
    return () => {
      this.subscribers.delete(callback);
    };
  }

  // Notify all subscribers
  private notifySubscribers(): void {
    const currentState = this.getState();
    this.subscribers.forEach(callback => {
      try {
        callback(currentState);
      } catch (error) {
        console.error('Error in mood service subscriber:', error);
      }
    });
  }

  // Update state
  private updateState(updates: Partial<MoodState>): void {
    this.state = { ...this.state, ...updates, lastUpdate: Date.now() };
    this.notifySubscribers();
    
    // Emit events based on what was updated
    if (updates.userMood) {
      moodEventService.emit(MOOD_EVENTS.MOOD_UPDATED, updates.userMood);
    }
    if (updates.weeklyTrends) {
      moodEventService.emit(MOOD_EVENTS.WEEKLY_TRENDS_UPDATED, updates.weeklyTrends);
    }
    if (updates.dailyMoods || updates.dailyNotes) {
      moodEventService.emit(MOOD_EVENTS.DAILY_DATA_UPDATED);
    }
    if (updates.topSongs) {
      moodEventService.emit(MOOD_EVENTS.SPOTIFY_DATA_UPDATED, updates.topSongs);
    }
  }

  // API calls
  private async fetchUserMood(): Promise<UserMood> {
    try {
      const response = await axios.get('/user-mood');
      return response.data;
    } catch (error) {
      console.error('Error fetching user mood:', error);
      throw error;
    }
  }

  private async fetchWeeklyTrends(date?: string): Promise<WeeklyTrend> {
    console.log('MoodService - fetchWeeklyTrends called with date:', date);
    try {
      const params = date ? { date } : {};
      const response = await axios.get('/trends/weekly', { params });
      console.log('MoodService - fetchWeeklyTrends response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error fetching weekly trends:', error);
      throw error;
    }
  }

  private async fetchDailyMoods(date: string): Promise<DailyMoodData> {
    try {
      const response = await axios.get('/trends/day', { 
        params: { date } 
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching daily moods:', error);
      throw error;
    }
  }

  private async fetchDailyNotes(date: string): Promise<DailyNotesData> {
    try {
      const response = await axios.get('/trends/notes', { 
        params: { date } 
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching daily notes:', error);
      throw error;
    }
  }

  private async fetchMoodDistribution(): Promise<MoodDistribution> {
    try {
      const response = await axios.get('/mood-distribution');
      return response.data;
    } catch (error) {
      console.error('Error fetching mood distribution:', error);
      throw error;
    }
  }

  private async fetchSuggestions(): Promise<Suggestions> {
    try {
      const response = await axios.get('/suggestions');
      return response.data;
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      throw error;
    }
  }

  private async fetchTopSongs(): Promise<TopSongs> {
    try {
      const response = await axios.get('/top-songs');
      return response.data;
    } catch (error) {
      console.error('Error fetching top songs:', error);
      throw error;
    }
  }

  // Public methods
  public async refreshAllData(): Promise<void> {
    this.updateState({ loading: true, error: null });

    try {
      const [
        userMood,
        weeklyTrends,
        moodDistribution,
        suggestions,
        topSongs
      ] = await Promise.all([
        this.fetchUserMood(),
        this.fetchWeeklyTrends(),
        this.fetchMoodDistribution(),
        this.fetchSuggestions(),
        this.fetchTopSongs()
      ]);

      this.updateState({
        userMood,
        weeklyTrends,
        moodDistribution,
        suggestions,
        topSongs,
        loading: false
      });
    } catch (error) {
      this.updateState({
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  public async refreshDailyData(date: string): Promise<void> {
    try {
      const [dailyMoods, dailyNotes] = await Promise.all([
        this.fetchDailyMoods(date),
        this.fetchDailyNotes(date)
      ]);

      this.updateState({
        dailyMoods,
        dailyNotes
      });
    } catch (error) {
      console.error('Error refreshing daily data:', error);
      this.updateState({
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  public async refreshWeeklyTrends(date?: string): Promise<void> {
    try {
      const weeklyTrends = await this.fetchWeeklyTrends(date);
      this.updateState({ weeklyTrends });
    } catch (error) {
      console.error('Error refreshing weekly trends:', error);
      this.updateState({
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  public async refreshUserMood(): Promise<void> {
    try {
      const userMood = await this.fetchUserMood();
      this.updateState({ userMood });
    } catch (error) {
      console.error('Error refreshing user mood:', error);
      this.updateState({
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Auto-refresh functionality
  private startAutoRefresh(): void {
    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval);
    }

    this.autoRefreshInterval = setInterval(() => {
      this.refreshAllData();
    }, 30000); // Refresh every 30 seconds
  }

  public stopAutoRefresh(): void {
    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval);
      this.autoRefreshInterval = null;
    }
  }

  public restartAutoRefresh(): void {
    this.startAutoRefresh();
  }

  // Manual trigger for mood updates
  public async onMoodUpdate(): Promise<void> {
    // Refresh all data when mood is updated
    await this.refreshAllData();
  }

  // Cleanup
  public destroy(): void {
    this.stopAutoRefresh();
    this.subscribers.clear();
  }
}

// Export singleton instance
export const moodService = MoodService.getInstance();

// Export types for use in components
export type { MoodState }; 
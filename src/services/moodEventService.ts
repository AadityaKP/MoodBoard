type EventCallback = (data?: any) => void;

class MoodEventService {
  private static instance: MoodEventService;
  private listeners: Map<string, Set<EventCallback>> = new Map();

  private constructor() {}

  public static getInstance(): MoodEventService {
    if (!MoodEventService.instance) {
      MoodEventService.instance = new MoodEventService();
    }
    return MoodEventService.instance;
  }

  // Subscribe to an event
  public on(event: string, callback: EventCallback): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    
    this.listeners.get(event)!.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  // Emit an event
  public emit(event: string, data?: any): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  // Remove all listeners for an event
  public off(event: string): void {
    this.listeners.delete(event);
  }

  // Remove all listeners
  public clear(): void {
    this.listeners.clear();
  }
}

// Export singleton instance
export const moodEventService = MoodEventService.getInstance();

// Event types
export const MOOD_EVENTS = {
  MOOD_UPDATED: 'mood_updated',
  DAILY_DATA_UPDATED: 'daily_data_updated',
  WEEKLY_TRENDS_UPDATED: 'weekly_trends_updated',
  SPOTIFY_DATA_UPDATED: 'spotify_data_updated',
  REFRESH_REQUESTED: 'refresh_requested'
} as const;

// Helper functions for common events
export const emitMoodUpdate = (moodData?: any) => {
  moodEventService.emit(MOOD_EVENTS.MOOD_UPDATED, moodData);
};

export const emitDailyDataUpdate = (date?: string) => {
  moodEventService.emit(MOOD_EVENTS.DAILY_DATA_UPDATED, date);
};

export const emitWeeklyTrendsUpdate = () => {
  moodEventService.emit(MOOD_EVENTS.WEEKLY_TRENDS_UPDATED);
};

export const emitSpotifyDataUpdate = (spotifyData?: any) => {
  moodEventService.emit(MOOD_EVENTS.SPOTIFY_DATA_UPDATED, spotifyData);
};

export const emitRefreshRequest = () => {
  moodEventService.emit(MOOD_EVENTS.REFRESH_REQUESTED);
}; 
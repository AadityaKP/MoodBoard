import { useEffect, useCallback } from 'react';
import { moodEventService, MOOD_EVENTS } from '../services/moodEventService';

export function useMoodEvent(event: string, callback: (data?: any) => void) {
  useEffect(() => {
    const unsubscribe = moodEventService.on(event, callback);
    return unsubscribe;
  }, [event, callback]);
}

// Specific event hooks
export function useMoodUpdate(callback: (moodData?: any) => void) {
  useMoodEvent(MOOD_EVENTS.MOOD_UPDATED, callback);
}

export function useDailyDataUpdate(callback: (date?: string) => void) {
  useMoodEvent(MOOD_EVENTS.DAILY_DATA_UPDATED, callback);
}

export function useWeeklyTrendsUpdate(callback: (trends?: any) => void) {
  useMoodEvent(MOOD_EVENTS.WEEKLY_TRENDS_UPDATED, callback);
}

export function useSpotifyDataUpdate(callback: (spotifyData?: any) => void) {
  useMoodEvent(MOOD_EVENTS.SPOTIFY_DATA_UPDATED, callback);
}

export function useRefreshRequest(callback: () => void) {
  useMoodEvent(MOOD_EVENTS.REFRESH_REQUESTED, callback);
}

// Hook for multiple events
export function useMoodEvents(events: Record<string, (data?: any) => void>) {
  useEffect(() => {
    const unsubscribers: (() => void)[] = [];
    
    Object.entries(events).forEach(([event, callback]) => {
      const unsubscribe = moodEventService.on(event, callback);
      unsubscribers.push(unsubscribe);
    });
    
    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, [events]);
}

// Hook for triggering refreshes
export function useMoodRefresh() {
  const triggerRefresh = useCallback(() => {
    moodEventService.emit(MOOD_EVENTS.REFRESH_REQUESTED);
  }, []);

  const triggerMoodUpdate = useCallback((moodData?: any) => {
    moodEventService.emit(MOOD_EVENTS.MOOD_UPDATED, moodData);
  }, []);

  const triggerDailyDataUpdate = useCallback((date?: string) => {
    moodEventService.emit(MOOD_EVENTS.DAILY_DATA_UPDATED, date);
  }, []);

  const triggerWeeklyTrendsUpdate = useCallback(() => {
    moodEventService.emit(MOOD_EVENTS.WEEKLY_TRENDS_UPDATED);
  }, []);

  const triggerSpotifyDataUpdate = useCallback((spotifyData?: any) => {
    moodEventService.emit(MOOD_EVENTS.SPOTIFY_DATA_UPDATED, spotifyData);
  }, []);

  return {
    triggerRefresh,
    triggerMoodUpdate,
    triggerDailyDataUpdate,
    triggerWeeklyTrendsUpdate,
    triggerSpotifyDataUpdate
  };
} 
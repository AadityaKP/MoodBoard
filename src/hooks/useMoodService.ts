import { useState, useEffect, useCallback } from 'react';
import { moodService, MoodState } from '../services/moodService';

export function useMoodService() {
  const [state, setState] = useState<MoodState>(moodService.getState());

  useEffect(() => {
    // Subscribe to mood service updates
    const unsubscribe = moodService.subscribe((newState) => {
      setState(newState);
    });

    // Initial data load if not already loaded
    if (state.lastUpdate === 0) {
      moodService.refreshAllData();
    }

    // Cleanup subscription on unmount
    return unsubscribe;
  }, []);

  // Wrapper functions for service methods
  const refreshAllData = useCallback(async () => {
    await moodService.refreshAllData();
  }, []);

  const refreshDailyData = useCallback(async (date: string) => {
    await moodService.refreshDailyData(date);
  }, []);

  const refreshWeeklyTrends = useCallback(async (date?: string) => {
    await moodService.refreshWeeklyTrends(date);
  }, []);

  const refreshUserMood = useCallback(async () => {
    await moodService.refreshUserMood();
  }, []);

  const onMoodUpdate = useCallback(async () => {
    await moodService.onMoodUpdate();
  }, []);

  return {
    // State
    ...state,
    
    // Actions
    refreshAllData,
    refreshDailyData,
    refreshWeeklyTrends,
    refreshUserMood,
    onMoodUpdate,
    
    // Service instance (for advanced usage)
    service: moodService
  };
}

// Hook for components that only need specific data
export function useMoodData<T extends keyof MoodState>(
  selector: (state: MoodState) => T
): Pick<MoodState, T> {
  const [selectedState, setSelectedState] = useState<Pick<MoodState, T>>(
    () => {
      const currentState = moodService.getState();
      return { [selector(currentState)]: currentState[selector(currentState)] } as Pick<MoodState, T>;
    }
  );

  useEffect(() => {
    const unsubscribe = moodService.subscribe((newState) => {
      setSelectedState({ [selector(newState)]: newState[selector(newState)] } as Pick<MoodState, T>);
    });

    return unsubscribe;
  }, [selector]);

  return selectedState;
}

// Specific hooks for common use cases
export function useUserMood() {
  return useMoodData((state) => 'userMood');
}

export function useWeeklyTrends() {
  return useMoodData((state) => 'weeklyTrends');
}

export function useDailyMoods() {
  return useMoodData((state) => 'dailyMoods');
}

export function useDailyNotes() {
  return useMoodData((state) => 'dailyNotes');
}

export function useMoodDistribution() {
  return useMoodData((state) => 'moodDistribution');
}

export function useSuggestions() {
  return useMoodData((state) => 'suggestions');
}

export function useTopSongs() {
  return useMoodData((state) => 'topSongs');
}

export function useMoodLoading() {
  return useMoodData((state) => 'loading');
}

export function useMoodError() {
  return useMoodData((state) => 'error');
} 
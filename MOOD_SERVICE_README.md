# Centralized Mood Service

This document describes the centralized mood service implementation that manages all mood data and provides real-time updates across components.

## Architecture Overview

The centralized mood service consists of three main parts:

1. **MoodService** - Core service managing state and API calls
2. **MoodEventService** - Event system for component communication
3. **React Hooks** - Easy integration with React components

## Core Services

### MoodService (`src/services/moodService.ts`)

The main service that manages all mood-related data:

- **Singleton Pattern**: Ensures only one instance exists
- **State Management**: Centralized state for all mood data
- **Auto-refresh**: Automatically refreshes data every 30 seconds
- **API Integration**: Handles all API calls to the backend
- **Event Emission**: Emits events when data changes

#### Key Methods:

```typescript
// Refresh all data
await moodService.refreshAllData();

// Refresh specific data
await moodService.refreshDailyData(date);
await moodService.refreshWeeklyTrends();
await moodService.refreshUserMood();

// Subscribe to updates
const unsubscribe = moodService.subscribe(callback);

// Manual mood update trigger
await moodService.onMoodUpdate();
```

### MoodEventService (`src/services/moodEventService.ts`)

Event system for component communication:

- **Event Types**: Predefined events for different data updates
- **Pub/Sub Pattern**: Components can subscribe to specific events
- **Automatic Cleanup**: Handles subscription cleanup

#### Available Events:

```typescript
MOOD_EVENTS.MOOD_UPDATED           // When user mood changes
MOOD_EVENTS.DAILY_DATA_UPDATED     // When daily data changes
MOOD_EVENTS.WEEKLY_TRENDS_UPDATED  // When weekly trends change
MOOD_EVENTS.SPOTIFY_DATA_UPDATED   // When Spotify data changes
MOOD_EVENTS.REFRESH_REQUESTED      // When refresh is requested
```

## React Hooks

### useMoodService (`src/hooks/useMoodService.ts`)

Main hook for accessing mood service data:

```typescript
const { 
  userMood, 
  weeklyTrends, 
  dailyMoods, 
  dailyNotes,
  moodDistribution,
  suggestions,
  topSongs,
  loading,
  error,
  refreshAllData,
  refreshDailyData,
  refreshWeeklyTrends,
  refreshUserMood,
  onMoodUpdate
} = useMoodService();
```

### Specific Data Hooks

For components that only need specific data:

```typescript
const { userMood } = useUserMood();
const { weeklyTrends } = useWeeklyTrends();
const { dailyMoods } = useDailyMoods();
const { dailyNotes } = useDailyNotes();
const { moodDistribution } = useMoodDistribution();
const { suggestions } = useSuggestions();
const { topSongs } = useTopSongs();
const { loading } = useMoodLoading();
const { error } = useMoodError();
```

### Event Hooks (`src/hooks/useMoodEvents.ts`)

For listening to specific events:

```typescript
// Listen to mood updates
useMoodUpdate((moodData) => {
  console.log('Mood updated:', moodData);
});

// Listen to daily data updates
useDailyDataUpdate((date) => {
  console.log('Daily data updated for:', date);
});

// Listen to multiple events
useMoodEvents({
  [MOOD_EVENTS.MOOD_UPDATED]: (data) => console.log('Mood updated'),
  [MOOD_EVENTS.SPOTIFY_DATA_UPDATED]: (data) => console.log('Spotify updated')
});

// Trigger events
const { triggerRefresh, triggerMoodUpdate } = useMoodRefresh();
```

## Component Integration

### Before (Old Way)

```typescript
// Components had to manage their own state and API calls
const [moods, setMoods] = useState({});
const [loading, setLoading] = useState(false);

useEffect(() => {
  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/moods');
      setMoods(response.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };
  fetchData();
}, []);
```

### After (New Way)

```typescript
// Components use centralized service
const { dailyMoods, loading, error } = useDailyMoods();

// Data is automatically managed and updated
// No need for manual API calls or state management
```

## Data Flow

1. **Initial Load**: Service loads all data on first use
2. **Auto-refresh**: Service refreshes data every 30 seconds
3. **Manual Updates**: Components can trigger specific refreshes
4. **Event Propagation**: Changes are broadcast to all subscribers
5. **Component Updates**: Components automatically re-render with new data

## Benefits

### For Developers

- **Reduced Boilerplate**: No need to manage API calls in each component
- **Consistent State**: All components see the same data
- **Automatic Updates**: Components stay in sync automatically
- **Type Safety**: Full TypeScript support with proper interfaces
- **Error Handling**: Centralized error handling

### For Users

- **Real-time Updates**: Data updates automatically across all components
- **Consistent Experience**: All parts of the app show the same data
- **Better Performance**: Reduced API calls and optimized updates
- **Reliable Data**: Centralized data management prevents inconsistencies

## Migration Guide

### Step 1: Update Component Imports

```typescript
// Old
import { useDashboardData } from '../hooks/useDashboardData';

// New
import { useMoodService } from '../hooks/useMoodService';
```

### Step 2: Replace Props with Hooks

```typescript
// Old
const MyComponent = ({ userMood, loading, error }) => {
  // Component logic
};

// New
const MyComponent = () => {
  const { userMood, loading, error } = useMoodService();
  // Component logic
};
```

### Step 3: Remove Manual API Calls

```typescript
// Old
useEffect(() => {
  const fetchData = async () => {
    const response = await axios.get('/api/data');
    setData(response.data);
  };
  fetchData();
}, []);

// New - No manual API calls needed
const { data } = useMoodService();
```

### Step 4: Update Parent Components

```typescript
// Old
<MyComponent 
  userMood={userMood}
  loading={loading}
  error={error}
/>

// New
<MyComponent />
```

## Error Handling

The service provides centralized error handling:

```typescript
const { error, loading } = useMoodService();

if (loading) return <LoadingSpinner />;
if (error) return <ErrorMessage error={error} />;
```

## Performance Considerations

- **Auto-refresh**: Set to 30 seconds to balance freshness with performance
- **Selective Updates**: Only components that need specific data subscribe to it
- **Event Debouncing**: Events are debounced to prevent excessive updates
- **Memory Management**: Proper cleanup of subscriptions and intervals

## Future Enhancements

- **Caching**: Add intelligent caching for better performance
- **Offline Support**: Cache data for offline usage
- **Optimistic Updates**: Update UI immediately, sync with server later
- **WebSocket Integration**: Real-time updates via WebSocket
- **Data Persistence**: Save data to localStorage for persistence 
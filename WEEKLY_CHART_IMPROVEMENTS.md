# Weekly Chart Improvements

This document describes the improvements made to the WeeklyChart component to dynamically update the week being displayed based on the selected date from the calendar.

## Key Improvements

### 1. **Dynamic Week Selection**
- Weekly chart now updates to show the week containing the selected date
- No longer limited to just the current week
- Seamless navigation between different weeks

### 2. **Server Endpoint Enhancement**
- Updated `/trends/weekly` endpoint to accept a date parameter
- Returns the week containing the specified date
- Maintains backward compatibility (defaults to current week if no date provided)

### 3. **Visual Feedback**
- Added week range display (e.g., "Jan 15 - Jan 21, 2025")
- Loading states for data refresh
- Smooth transitions between different weeks

### 4. **Integration with Calendar**
- Calendar day selection automatically updates weekly chart
- Synchronized data across all components
- Proper state management through mood service

## Technical Changes

### Server Endpoint (`server.js`)

#### Before:
```javascript
app.get('/trends/weekly', (req, res) => {
  // Always return the current week (Sunday to Saturday)
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay()); // Sunday
  // ... rest of implementation
});
```

#### After:
```javascript
app.get('/trends/weekly', (req, res) => {
  // Accept ?date=YYYY-MM-DD to get week containing that date
  const { date } = req.query;
  
  // Determine the target date (either provided date or today)
  let targetDate;
  if (date) {
    targetDate = new Date(date);
    if (isNaN(targetDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
    }
  } else {
    targetDate = new Date();
  }
  
  // Get start of week (Sunday) for the target date
  const weekStart = new Date(targetDate);
  weekStart.setDate(targetDate.getDate() - targetDate.getDay()); // Sunday
  // ... rest of implementation
});
```

### Mood Service (`src/services/moodService.ts`)

#### Enhanced Weekly Trends Method:
```typescript
private async fetchWeeklyTrends(date?: string): Promise<WeeklyTrend> {
  try {
    const params = date ? { date } : {};
    const response = await axios.get('/trends/weekly', { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching weekly trends:', error);
    throw error;
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
```

### WeeklyChart Component (`src/components/WeeklyChart.tsx`)

#### Key Features Added:

1. **Dynamic Week Refresh**:
```typescript
useEffect(() => {
  if (selectedDay) {
    setIsRefreshing(true);
    const dateStr = selectedDay.toISOString().slice(0, 10);
    refreshWeeklyTrends(dateStr).finally(() => {
      setIsRefreshing(false);
    });
  }
}, [selectedDay, refreshWeeklyTrends]);
```

2. **Week Range Display**:
```typescript
const getWeekRange = () => {
  if (week.length === 0) return '';
  const startDate = new Date(week[0].day);
  const endDate = new Date(week[6].day);
  const startStr = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endStr = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${startStr} - ${endStr}`;
};
```

3. **Loading States**:
```typescript
if (loading || isRefreshing) {
  return (
    <div className="space-y-2 w-full h-full flex flex-col justify-center">
      <div className="text-center text-xs text-gray-500 mb-2">
        {isRefreshing ? 'Updating weekly data...' : 'Loading weekly data...'}
      </div>
      {/* Loading skeleton */}
    </div>
  );
}
```

## User Experience

### Before:
- Weekly chart always showed current week
- No way to view historical weekly data
- Limited to current week's mood trends

### After:
- **Dynamic Week Selection**: Click any date in calendar to view that week
- **Week Range Display**: Clear indication of which week is being shown
- **Loading Feedback**: Visual feedback when switching between weeks
- **Seamless Navigation**: Smooth transitions between different weeks

## Integration Flow

1. **User selects a date** in the calendar
2. **Calendar triggers** `onDaySelect` with the selected date
3. **Main dashboard** updates `selectedDay` state
4. **WeeklyChart component** detects `selectedDay` change
5. **WeeklyChart calls** `refreshWeeklyTrends(dateStr)`
6. **Mood service** makes API call to `/trends/weekly?date=YYYY-MM-DD`
7. **Server returns** week data containing the selected date
8. **WeeklyChart updates** to show the new week
9. **InsightsBox automatically updates** with new weekly trends

## Benefits

### For Users:
- **Historical Analysis**: View mood trends for any week
- **Better Context**: See how moods changed over time
- **Flexible Navigation**: Easy to compare different weeks
- **Clear Feedback**: Know exactly which week is being displayed

### For Developers:
- **Reusable API**: Server endpoint supports any date
- **Type Safety**: Full TypeScript support
- **Performance**: Efficient data loading with loading states
- **Maintainability**: Clean separation of concerns

## API Usage

### Basic Usage:
```javascript
// Get current week
GET /trends/weekly

// Get week containing specific date
GET /trends/weekly?date=2025-01-15
```

### Response Format:
```json
{
  "week": [
    {
      "day": "2025-01-12",
      "sections": {
        "morning": "Happy + Calm",
        "afternoon": "Sad + Energetic",
        "evening": "Happy + Energetic",
        "night": "Sad + Calm"
      },
      "dayOfWeek": "Sun"
    },
    // ... 6 more days
  ]
}
```

## Future Enhancements

1. **Week Navigation**: Add previous/next week buttons
2. **Week Comparison**: Compare multiple weeks side by side
3. **Trend Indicators**: Show mood trends over multiple weeks
4. **Custom Date Ranges**: Allow selecting custom date ranges
5. **Export Functionality**: Export weekly data for analysis 
import { useWeeklyTrends, useMoodLoading, useMoodError } from '../hooks/useMoodService';

interface MoodAnalysis {
  timeChunk: string;
  topMood: string;
  frequency: number;
  consistency: number;
  insight: string;
  suggestions: string[];
  warning?: string;
}

interface InsightsBoxProps {
  selectedDay: Date;
}

export default function InsightsBox({ selectedDay }: InsightsBoxProps) {
  const { weeklyTrends } = useWeeklyTrends();
  const { loading } = useMoodLoading();
  const { error } = useMoodError();
  
  // The weekly trends will automatically update when the selected day changes
  // because the parent component triggers the refresh
  
  // Mood content mapping from Weekly Trends.txt
  const moodContentMap: Record<string, { insight: string; suggestions: string[] }> = {
    'morning_sad calm': {
      insight: "Your mornings are quite consistent, but unfortunately, that consistency leans toward feeling emotionally low. This may be an early sign of a draining start to your day.",
      suggestions: [
        "Avoid screen time right after waking",
        "Go for a 10-minute walk or play uplifting music",
        "Sleep early to avoid grogginess"
      ]
    },
    'morning_sad energetic': {
      insight: "You're starting the day with emotional turbulence — perhaps anxiety or pressure. That may weigh you down through the day.",
      suggestions: [
        "Start with slow breathing or journaling",
        "Avoid rushing — give yourself margin time",
        "Listen to calming music instead of news"
      ]
    },
    'morning_happy calm': {
      insight: "You've built a peaceful start to your mornings. This calm emotional baseline can anchor your entire day.",
      suggestions: [
        "Continue a slow, unrushed morning routine",
        "Practice gratitude or light journaling",
        "Avoid any sudden overstimulation"
      ]
    },
    'morning_happy energetic': {
      insight: "Mornings are your superpower! You wake up with energy and drive — perfect for tackling creative or focused work.",
      suggestions: [
        "Block distractions and start deep work early",
        "Consider an early workout or idea brainstorming",
        "Reflect at the end of the day on what worked best"
      ]
    },
    'afternoon_sad calm': {
      insight: "You may be experiencing an afternoon slump. Repeated calm sadness could mean low energy or disengagement.",
      suggestions: [
        "Go for a short walk in sunlight",
        "Try a snack or hydration break",
        "Do a quick 5-minute body stretch or music break"
      ]
    },
    'afternoon_sad energetic': {
      insight: "Tension or mental fatigue may be peaking in your afternoons — especially if mornings were tough.",
      suggestions: [
        "Step away from screens briefly",
        "Use upbeat but grounding music",
        "Break large tasks into tiny wins"
      ]
    },
    'afternoon_happy calm': {
      insight: "You maintain balance well during afternoons. A steady state like this supports thoughtful and sustained work.",
      suggestions: [
        "Take microbreaks to avoid dips",
        "Reflect on small wins from the day",
        "Consider shifting intense tasks to earlier/later"
      ]
    },
    'afternoon_happy energetic': {
      insight: "Your energy peaks in the afternoon — this is your productivity window!",
      suggestions: [
        "Plan key work between 2–5 PM",
        "Say no to low-priority tasks here",
        "Take breaks before and after the peak zone"
      ]
    },
    'evening_sad calm': {
      insight: "You're winding down, but in a low or disconnected way. This may point to emotional fatigue.",
      suggestions: [
        "Watch or read something light",
        "Do something creative or reflective",
        "Share your thoughts with a trusted person"
      ]
    },
    'evening_sad energetic': {
      insight: "You might feel restless or mentally crowded in the evening. This can make it hard to relax or sleep.",
      suggestions: [
        "Try journaling out your thoughts",
        "Listen to calming instrumental music",
        "Dim your lighting as the night approaches"
      ]
    },
    'evening_happy calm': {
      insight: "A calm, content evening often means a peaceful close to your day. This sets you up for deep rest.",
      suggestions: [
        "Keep a regular night wind-down ritual",
        "Avoid social media scroll traps",
        "Celebrate small wins of the day"
      ]
    },
    'evening_happy energetic': {
      insight: "You're energized in the evening — this can be great for hobbies or workouts, but be mindful of late stimulation.",
      suggestions: [
        "Wrap up activities an hour before bed",
        "Use the burst for creativity or social time",
        "Try switching to slower-paced content after 9 PM"
      ]
    },
    'night_sad calm': {
      insight: "Going to sleep feeling low may affect the next morning. You might be carrying stress into bed.",
      suggestions: [
        "Do a gratitude or '3 good things' reflection",
        "Journal or talk out lingering worries",
        "Use a guided sleep meditation"
      ]
    },
    'night_sad energetic': {
      insight: "Your mind seems active and restless late at night. This could disrupt your sleep quality.",
      suggestions: [
        "Reduce screen brightness or turn on Night Mode",
        "Try calming teas like chamomile",
        "Stretch or do deep breathing before bed"
      ]
    },
    'night_happy calm': {
      insight: "You're ending your day in a positive and peaceful space. This is ideal for healthy rest and emotional reset.",
      suggestions: [
        "Stick to your soothing night rituals",
        "Use affirmations or light reading",
        "Disconnect from noise — let your mind slow down"
      ]
    },
    'night_happy energetic': {
      insight: "While feeling great at night is awesome, it may make sleep difficult if not dialed down gradually.",
      suggestions: [
        "Set a wind-down alarm (just like a wake-up one)",
        "Avoid upbeat playlists close to bedtime",
        "Swap screens for books or art an hour before bed"
      ]
    }
  };

  // Get emoji for mood
  const getMoodEmoji = (mood: string) => {
    switch (mood) {
      case 'sad calm': return '😔';
      case 'sad energetic': return '😣';
      case 'happy calm': return '😊';
      case 'happy energetic': return '⚡';
      default: return '❓';
    }
  };

  // Analyze weekly mood trends
  const analyzeWeeklyMoods = (): MoodAnalysis[] => {
    if (!weeklyTrends?.trends || weeklyTrends.trends.length === 0) {
      return [];
    }

    const timeChunks = ['morning', 'afternoon', 'evening', 'night'];
    const analyses: MoodAnalysis[] = [];

    timeChunks.forEach(chunk => {
      // Extract moods for this chunk across all days
      const chunkMoods: string[] = [];
      weeklyTrends.trends.forEach(day => {
        if (day.moods && day.moods[chunk]) {
          chunkMoods.push(String(day.moods[chunk]));
        }
      });

      if (chunkMoods.length === 0) return;

      // Calculate frequency
      const moodCounts: Record<string, number> = {};
      chunkMoods.forEach(mood => {
        moodCounts[mood] = (moodCounts[mood] || 0) + 1;
      });

      // Find top mood
      const topMood = Object.entries(moodCounts).reduce((a, b) => 
        (moodCounts[a[0]] || 0) > (moodCounts[b[0]] || 0) ? a : b
      )[0];
      const frequency = moodCounts[topMood];

      // Calculate consistency
      const consistency = Math.round((frequency / 7) * 100) / 100;

      // Get content from mapping
      const contentKey = `${chunk}_${topMood}`;
      const content = moodContentMap[contentKey] || {
        insight: "No specific insight available for this mood pattern.",
        suggestions: ["Continue tracking your moods to get personalized insights."]
      };

      // Check for warning
      let warning: string | undefined;
      if ((topMood === 'sad calm' || topMood === 'sad energetic') && frequency >= 4) {
        warning = `⚠ You've experienced ${topMood} ${frequency} times this week — this could be affecting your well-being. Try reviewing your ${chunk} routine.`;
      }

      analyses.push({
        timeChunk: chunk,
        topMood,
        frequency,
        consistency,
        insight: content.insight,
        suggestions: content.suggestions,
        warning
      });
    });

    return analyses;
  };
  if (loading) {
    return (
      <div className="bg-white/80 rounded-xl shadow-lg p-3 border border-purple-200 h-full">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded mb-3"></div>
          <div className="h-3 bg-gray-200 rounded mb-2"></div>
          <div className="h-3 bg-gray-200 rounded mb-2"></div>
          <div className="h-3 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white/80 rounded-xl shadow-lg p-3 border border-purple-200 h-full">
        <div className="text-red-500 text-center text-sm">Error: {error}</div>
      </div>
    );
  }



  return (
    <div className="bg-white/80 rounded-xl shadow-lg p-3 border border-purple-200 h-full flex flex-col">
      <h2 className="text-lg font-semibold text-purple-600 mb-3 text-center">Weekly Trends</h2>
      
      <div className="flex-1 space-y-3 overflow-y-auto">
        {analyzeWeeklyMoods().map((analysis, index) => (
          <div key={index} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-purple-700 capitalize">
                🕒 {analysis.timeChunk} TRENDS
              </h3>
              <span className="text-sm text-gray-500">
                Consistency: {analysis.consistency}
              </span>
            </div>
            
            {/* Mood Info */}
            <div className="mb-3">
              <div className="text-sm text-gray-700">
                Most frequent mood: {getMoodEmoji(analysis.topMood)} {analysis.topMood} ({analysis.frequency} out of 7)
              </div>
            </div>
            
            {/* Insight */}
            <div className="mb-3">
              <div className="text-sm text-gray-700 bg-white p-3 rounded border-l-4 border-purple-300">
                <span className="font-medium">💬 Insight:</span> {analysis.insight}
              </div>
            </div>
            
            {/* Suggestions */}
            <div className="mb-3">
              <div className="text-sm text-gray-700 bg-white p-3 rounded border-l-4 border-green-300">
                <span className="font-medium">✅ Suggestions:</span>
                <ul className="mt-2 space-y-2">
                  {analysis.suggestions.map((suggestion, idx) => (
                    <li key={idx} className="ml-4">• {suggestion}</li>
                  ))}
                </ul>
              </div>
            </div>
            
            {/* Warning */}
            {analysis.warning && (
              <div className="text-sm text-red-700 bg-red-50 p-3 rounded border-l-4 border-red-300">
                {analysis.warning}
              </div>
            )}
          </div>
        ))}
        
        {/* Fallback when no data */}
        {analyzeWeeklyMoods().length === 0 && (
          <div className="text-center text-gray-500 text-sm">
            No weekly mood data available. Start tracking your moods to see insights!
          </div>
        )}
      </div>
    </div>
  );
} 
import { useState, useEffect } from "react";
import MoodBox from "@/components/MoodBox";
import MusicPlayer from "@/components/MusicPlayer";
import TopSongsBox from "@/components/TopSongsBox";
import Reflections from "@/components/Reflections";
import DayMoodNotes from "@/components/DayMoodNotes";
import WeeklyChart from "@/components/WeeklyChart";
import MonthlyCalendar from "@/components/MonthlyCalendar";
import InsightsBox from "@/components/InsightsBox";
import DigitalClock from "@/components/DigitalClock";
import GifBox from "@/components/GifBox";
import { useMoodService } from "../hooks/useMoodService";

interface SpotifyUser {
  id: string;
  display_name: string;
  images: Array<{ url: string }>;
}

// Helper function to format date without timezone issues
function formatDateForAPI(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function UnifiedDashboard() {
  const { userMood, weeklyTrends, loading, error, refreshAllData, refreshDailyData, refreshWeeklyTrends } = useMoodService();
  const [selectedDay, setSelectedDay] = useState(() => {
    // Initialize to today's date
    const today = new Date();
    return today;
  });
  const [spotifyUser, setSpotifyUser] = useState<SpotifyUser | null>(null);

  // Load initial daily data for today
  useEffect(() => {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    refreshDailyData(todayStr);
  }, [refreshDailyData]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-100 p-1 md:p-2">
      {/* Header with centered MoodBoard title and Spotify info */}
      <div className="flex items-center justify-between px-6 py-3 bg-white/90 backdrop-blur-sm shadow-lg rounded-xl mb-4">
        <div className="flex-1"></div>
        <div className="text-xl font-bold text-purple-700">MoodBoard</div>
        <div className="flex-1 flex justify-end">
          {/* Spotify User Info */}
          <div className="flex items-center space-x-3">
            {spotifyUser ? (
              <>
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-900">{spotifyUser.display_name}</div>
                </div>
                {spotifyUser.images && spotifyUser.images[0] && (
                  <img 
                    src={spotifyUser.images[0].url} 
                    alt={spotifyUser.display_name}
                    className="w-8 h-8 rounded-full border-2 border-purple-200"
                  />
                )}
              </>
            ) : (
              <div className="text-sm text-gray-500">Not connected to Spotify</div>
            )}
          </div>
        </div>
      </div>
      
      <div className="w-full pt-2 pb-4">
        {/* Main Grid Layout - 5 columns with consistent heights */}
        <div className="grid grid-cols-12 gap-2">
          {/* Column 1 - Reflections and Calendar */}
          <div className="col-span-2 flex flex-col space-y-2 h-[calc(100vh-24rem)]">
            <DigitalClock />
            <Reflections selectedDay={selectedDay} />
            <div className="bg-white/80 rounded-xl shadow-lg p-3 border border-purple-200 flex-1">
              <h2 className="text-lg font-semibold text-purple-600 mb-3 text-center">Calendar</h2>
              <div className="flex justify-center pb-2">
                <MonthlyCalendar
                  onDaySelect={day => {
                    setSelectedDay(day);
                    // Refresh daily data for the selected day
                    const dayStr = formatDateForAPI(day);
                    refreshDailyData(dayStr);
                    // Also refresh weekly trends for the selected day
                    refreshWeeklyTrends(dayStr);
                  }}
                  selectedDay={selectedDay}
                />
              </div>
            </div>
          </div>

          {/* Column 2 - Day Mood Notes */}
          <div className="col-span-3 h-[calc(100vh-24rem)]">
            <DayMoodNotes 
              selectedDay={selectedDay}
            />
          </div>

          {/* Column 3 - Current Mood and Weekly Trends */}
          <div className="col-span-3 flex flex-col space-y-2 h-[calc(100vh-24rem)]">
            <MoodBox userMood={userMood} loading={loading} error={error} />
            <div className="bg-white/80 rounded-xl shadow-lg p-3 border border-purple-200 flex-1">
              <h2 className="text-lg font-semibold text-purple-600 mb-2 text-center">Weekly Trends</h2>
              <WeeklyChart
                onDayClick={day => {
                  setSelectedDay(day);
                  // Refresh daily data for the selected day
                  const dayStr = formatDateForAPI(day);
                  refreshDailyData(dayStr);
                  // Also refresh weekly trends for the selected day
                  refreshWeeklyTrends(dayStr);
                }}
                selectedDay={selectedDay}
              />
            </div>
          </div>

          {/* Column 4 - Insights */}
          <div className="col-span-2 h-[calc(100vh-24rem)]">
            <InsightsBox selectedDay={selectedDay} />
          </div>

          {/* Column 5 - Player and Top Songs */}
          <div className="col-span-2 flex flex-col space-y-2 h-[calc(100vh-24rem)]">
            <MusicPlayer onAnalysis={refreshAllData} setUser={setSpotifyUser} />
            <TopSongsBox userMood={userMood} loading={loading} error={error} />
          </div>
        </div>

        {/* Footer with GifBox spanning columns 2-3 */}
        <div className="mt-4 grid grid-cols-12 gap-2">
          <div className="col-span-2">
            {/* Empty space for column 1 */}
          </div>
          <div className="col-span-6">
            <GifBox />
          </div>
          <div className="col-span-4">
            {/* Empty space for columns 4-5 */}
          </div>
        </div>
      </div>

      {/* Footer with creator credits */}
      <div className="w-full bg-white/90 backdrop-blur-sm shadow-lg rounded-xl mt-4 p-3 border border-purple-200">
        <div className="text-center text-sm text-gray-600">
          Created by: Aaditya KP, Adithi Rao
        </div>
      </div>
    </div>
  );
}

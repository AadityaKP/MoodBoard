import MoodBox from "@/components/MoodBox";
import SuggestionsBox from "@/components/SuggestionsBox";
import MusicPlayer from "@/components/MusicPlayer";
import TopSongsBox from "@/components/TopSongsBox";
import WeeklyTrendsBox from "@/components/WeeklyTrendsBox";
import ReflectionsBox from "@/components/ReflectionsBox";
import { useDashboardData } from "../hooks/useDashboardData";

export default function Home() {
  const dashboardData = useDashboardData();
  const { refresh } = dashboardData;
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-extrabold text-center text-purple-700 mb-2 drop-shadow-lg">
          Your Mood Dashboard
        </h1>
        <div className="text-center text-blue-900 text-base mb-6">
          Date: {dashboardData.userMood.date} | Day: {dashboardData.userMood.day} | Time: {dashboardData.userMood.time}
        </div>
        {/* Top Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <MoodBox userMood={dashboardData.userMood} moodDistribution={dashboardData.moodDistribution} loading={dashboardData.loading} error={dashboardData.error} />
          <SuggestionsBox suggestions={dashboardData.suggestions} loading={dashboardData.loading} error={dashboardData.error} />
          <MusicPlayer onAnalysis={refresh} />
        </div>
        {/* Bottom Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <TopSongsBox userMood={dashboardData.userMood} topSongs={dashboardData.topSongs} loading={dashboardData.loading} error={dashboardData.error} />
          <WeeklyTrendsBox weeklyTrends={dashboardData.weeklyTrends} loading={dashboardData.loading} error={dashboardData.error} />
          <ReflectionsBox userMood={dashboardData.userMood} loading={dashboardData.loading} error={dashboardData.error} />
        </div>
      </div>
    </div>
  );
}

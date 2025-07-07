import TrendsDayBar from "@/components/TrendsDayBar";
import TrendsNotesPostIts from "@/components/TrendsNotesPostIts";
import WeeklyChart from "@/components/WeeklyChart";
import MonthlyCalendar from "@/components/MonthlyCalendar";
import { useState } from "react";

export default function TrendsPage() {
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [selectedSection, setSelectedSection] = useState("morning");

  return (
    <div className="min-h-screen h-screen w-full bg-gradient-to-br from-blue-50 to-purple-100 p-2 md:p-8 flex flex-col overflow-hidden">
      <h1 className="text-3xl font-bold text-purple-700 mb-8 mx-auto">Trends</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 grid-rows-2 gap-8 flex-1 w-full h-full" style={{height: 'calc(100vh - 6rem)'}}>
        {/* Top Left: Trends Bar */}
        <div className="bg-white/80 rounded-xl shadow-lg p-8 flex flex-col items-center justify-center border border-purple-200 aspect-square w-full h-full max-h-full max-w-full">
          <h2 className="text-2xl font-semibold text-purple-600 mb-6">Mood by Day Section</h2>
          <div className="w-full h-full flex items-center justify-center">
            <TrendsDayBar
              selectedDay={selectedDay}
              selectedSection={selectedSection}
              onSectionHover={section => setSelectedSection(section)}
              onSectionClick={section => setSelectedSection(section)}
            />
          </div>
        </div>
        {/* Top Right: Calendar */}
        <div className="bg-white/80 rounded-xl shadow-lg p-8 flex flex-col items-center justify-center border border-purple-200 aspect-square w-full h-full max-h-full max-w-full">
          <h2 className="text-2xl font-semibold text-purple-600 mb-6">Monthly Calendar</h2>
          <div className="w-full h-full flex items-center justify-center">
            <MonthlyCalendar
              onDaySelect={day => setSelectedDay(day)}
              selectedDay={selectedDay}
            />
          </div>
        </div>
        {/* Bottom Left: Notes Section */}
        <div className="bg-white/80 rounded-xl shadow-lg p-8 flex flex-col items-center justify-center border border-purple-200 aspect-square w-full h-full max-h-full max-w-full">
          <h2 className="text-2xl font-semibold text-purple-600 mb-6">Reflections & Notes</h2>
          <div className="w-full h-full flex items-center justify-center">
            <TrendsNotesPostIts day={selectedDay} />
          </div>
        </div>
        {/* Bottom Right: Weekly Chart */}
        <div className="bg-white/80 rounded-xl shadow-lg p-8 flex flex-col items-center justify-center border border-purple-200 aspect-square w-full h-full max-h-full max-w-full">
          <h2 className="text-2xl font-semibold text-purple-600 mb-6">Weekly Mood Trends</h2>
          <div className="w-full h-full flex items-center justify-center">
            <WeeklyChart
              onDayClick={day => setSelectedDay(day)}
              selectedDay={selectedDay}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

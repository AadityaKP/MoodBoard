import React from 'react';

const WeeklyTrendsBox = ({ weeklyTrends, loading, error }: any) => {
  if (loading) return <div className="rounded-lg p-4 bg-purple-100 text-purple-900 shadow">Loading...</div>;
  if (error) return <div className="rounded-lg p-4 bg-purple-100 text-purple-900 shadow">Error: {error}</div>;

  return (
    <div className="rounded-lg p-4 bg-purple-100 text-purple-900 shadow">
      <h2 className="text-lg font-bold mb-2">Weekly Trends</h2>
      <ul className="list-disc pl-5">
        {(weeklyTrends.trends || []).map((t: any, i: number) => <li key={i}>{t.summary}</li>)}
      </ul>
    </div>
  );
};

export default WeeklyTrendsBox;

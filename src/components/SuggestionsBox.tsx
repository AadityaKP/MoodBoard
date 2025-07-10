import React from 'react';

const SuggestionsBox = ({ suggestions, loading, error }: any) => {
  if (loading) return <div className="rounded-lg p-4 bg-green-100 text-green-900 shadow">Loading...</div>;
  if (error) return <div className="rounded-lg p-4 bg-green-100 text-green-900 shadow">Error: {error}</div>;

  return (
    <div className="rounded-lg p-4 bg-green-100 text-green-900 shadow">
      <h2 className="text-lg font-bold mb-2">Suggestions</h2>
      <ul className="list-disc pl-5">
        {(suggestions.suggestions || []).map((s: string, i: number) => <li key={i}>{s}</li>)}
      </ul>
    </div>
  );
};

export default SuggestionsBox;

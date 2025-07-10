import React, { useState } from 'react';
import axios from 'axios';

const ReflectionsBox = ({ userMood, loading, error }: any) => {
  const [reflection, setReflection] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reflection.trim()) return;
    await axios.post('/reflections', {
      reflection,
      date: userMood.date,
      day: userMood.day,
      time: userMood.time
    });
    setReflection('');
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 2000);
  };

  if (loading) return <div className="rounded-lg p-4 bg-gray-100 text-gray-900 shadow">Loading...</div>;
  if (error) return <div className="rounded-lg p-4 bg-gray-100 text-gray-900 shadow">Error: {error}</div>;

  return (
    <div className="rounded-lg p-4 bg-gray-100 text-gray-900 shadow">
      <h2 className="text-lg font-bold mb-2">Reflections</h2>
      <form onSubmit={handleSubmit}>
        <textarea
          className="w-full p-2 border rounded mb-2"
          value={reflection}
          onChange={e => setReflection(e.target.value)}
          placeholder="Write your thoughts..."
        />
        <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">Submit</button>
      </form>
      {submitted && <div className="text-green-600 mt-2">Reflection submitted!</div>}
    </div>
  );
};

export default ReflectionsBox;

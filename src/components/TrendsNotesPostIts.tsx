import React, { useEffect, useState } from 'react';
import axios from 'axios';

const SECTIONS = ['morning', 'afternoon', 'evening', 'night'];
const COLORS = ['bg-yellow-200', 'bg-green-200', 'bg-pink-200', 'bg-blue-200'];

function toDDMMYYYY(date) {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

export default function TrendsNotesPostIts({ day }) {
  const [notes, setNotes] = useState({});

  useEffect(() => {
    const fetchNotes = async () => {
      const dateStr = toDDMMYYYY(day);
      const res = await axios.get('/trends/notes', { params: { date: dateStr } });
      const notesArr = Array.isArray(res.data.notes) ? res.data.notes : [];
      const notesBySection = {};
      for (const section of SECTIONS) {
        const found = notesArr.find(n => (n.time || n['Time of Day'] || '').toLowerCase() === section);
        notesBySection[section] = found ? found.note : '';
      }
      setNotes(notesBySection);
    };
    fetchNotes();
  }, [day]);

  return (
    <div className="flex flex-col gap-2 items-center">
      {/* Debug: Show raw notes fetched */}
      {/* <pre>{JSON.stringify(notes, null, 2)}</pre> */}
      <div className="flex gap-4">
        {SECTIONS.map((section, i) => (
          <div key={section} className={`w-32 h-32 p-2 ${COLORS[i]} rounded shadow flex flex-col`}>
            <div className="font-bold capitalize mb-1">{section}</div>
            <div className="flex-1 text-sm">{notes[section]}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

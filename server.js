import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import SpotifyWebApi from 'spotify-web-api-node';
import FormData from 'form-data';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';

// --- Setup ---
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const client_id = process.env.SPOTIFY_CLIENT_ID;
const client_secret = process.env.SPOTIFY_CLIENT_SECRET;
const redirect_uri = process.env.SPOTIFY_REDIRECT_URI;

const playlistFolder = path.join(__dirname, 'UserPlaylist');
const csvFile = path.join(__dirname, 'listening_history.csv');
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(csvFile)) {
  fs.writeFileSync(csvFile, 'Song Name,Artist(s),Time Listened,Chunk\n', 'utf8');
}
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir);
}

const CSVS_DIR = path.join(__dirname, 'CSVS');
const moodCsv = path.join(CSVS_DIR, 'time+day+mood.csv');
const notesCsv = path.join(CSVS_DIR, 'time+note+day+date.csv');
const transitionsCsv = path.join(CSVS_DIR, 'mood_transitions_activities.csv');

// --- Spotify OAuth State ---
let access_token = '';
let refresh_token = '';

// --- Spotify API Client ---
const spotifyApi = new SpotifyWebApi({
  clientId: client_id,
  clientSecret: client_secret,
  redirectUri: redirect_uri
});

// --- Helper: Sanitize String ---
function sanitize(name) {
  return name
    .normalize('NFKD')
    .replace(/["'""'']/g, '')
    .replace(/[^a-zA-Z0-9 \-_]/g, '')
    .trim()
    .toLowerCase();
}

// --- Helper: Upload to Reccobeats ---
async function uploadToReccobeats(mp3Path) {
  try {
    const form = new FormData();
    form.append('audioFile', fs.createReadStream(mp3Path));
    const res = await axios.post(
      'https://api.reccobeats.com/v1/analysis/audio-features',
      form,
      { headers: form.getHeaders() }
    );
    return res.data;
  } catch (e) {
    console.error('❌ Upload failed:', e.response?.data || e.message);
    return null;
  }
}

// --- Helper: Analyze Chunks ---
async function analyzeChunks(filepath, baseInfo) {
  ffmpeg.setFfmpegPath(ffmpegPath);
  // Get duration
  const getDuration = () =>
    new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filepath, (err, metadata) => {
        if (err) reject(err);
        else resolve(metadata.format.duration);
      });
    });
  const totalDuration = await getDuration();
  const chunkDuration = 30;
  const chunkCount = Math.ceil(totalDuration / chunkDuration);

  for (let i = 0; i < chunkCount; i++) {
    const startTime = i * chunkDuration;
    const chunkPath = path.join(tempDir, `chunk_${i}.mp3`);
    await new Promise((resolve, reject) => {
      ffmpeg(filepath)
        .setStartTime(startTime)
        .duration(chunkDuration)
        .audioCodec('libmp3lame')
        .audioBitrate(192)
        .output(chunkPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });
    if (!fs.existsSync(chunkPath) || fs.statSync(chunkPath).size === 0) {
      console.log(`❌ Chunk ${i + 1} not created properly. Skipping.`);
      continue;
    }
    let features = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      features = await uploadToReccobeats(chunkPath);
      if (features) break;
      else console.log(`⚠️ Retry ${attempt + 1} failed for Chunk ${i + 1}.`);
    }
    let moodName = 'Unknown';
    if (features) {
      // Call ML API to get mood for this chunk
      try {
        const response = await axios.post('http://127.0.0.1:5001/predict-mood', {
          features: {
            danceability: features.danceability,
            energy: features.energy,
            loudness: features.loudness,
            speechiness: features.speechiness,
            acousticness: features.acousticness,
            instrumentalness: features.instrumentalness,
            liveness: features.liveness,
            valence: features.valence,
            tempo: features.tempo
          },
          song_name: baseInfo.songName,
          chunk_number: i + 1
        });
        moodName = response.data.mood;
      } catch (err) {
        console.error('ML API mood prediction failed:', err.message);
      }
      // Write to CSV
      const row = {
        'Song Name': baseInfo.songName,
        'Artist(s)': baseInfo.artistStr,
        'Time Listened': baseInfo.timeListened,
        'Chunk': `Chunk ${i + 1}`,
        ...features,
        'Mood_Name': moodName
      };
      // Append row
      const csvLine = Object.values(row).map(v => `"${String(v).replace(/"/g, '""')}"`).join(',') + '\n';
      fs.appendFileSync(csvFile, csvLine, 'utf8');
    }
    fs.unlinkSync(chunkPath);
  }
}

// --- Spotify OAuth Endpoints ---
app.get('/login', (req, res) => {
  const scopes = 'user-read-playback-state user-modify-playback-state user-read-currently-playing';
  const authUrl = `https://accounts.spotify.com/authorize?response_type=code&client_id=${client_id}&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(redirect_uri)}`;
  res.redirect(authUrl);
});

app.get('/callback', async (req, res) => {
  const code = req.query.code || null;
  try {
    const tokenRes = await axios.post('https://accounts.spotify.com/api/token', new URLSearchParams({
      code,
      redirect_uri,
      grant_type: 'authorization_code',
      client_id,
      client_secret
    }).toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    access_token = tokenRes.data.access_token;
    refresh_token = tokenRes.data.refresh_token;
    spotifyApi.setAccessToken(access_token);
    spotifyApi.setRefreshToken(refresh_token);
    res.send(`
      <html>
        <body>
          <script>
            window.opener.postMessage({ type: 'SPOTIFY_TOKEN', token: '${access_token}' }, '*');
            window.close();
          </script>
          <p>Login successful! You can close this window.</p>
        </body>
      </html>
    `);
  } catch (err) {
    console.error('Token exchange failed:', err.response?.data || err.message);
    res.send('Error exchanging code for token.');
  }
});

// --- Playback Info Endpoint ---
app.get('/current', async (req, res) => {
  try {
    const { data } = await axios.get('https://api.spotify.com/v1/me/player', {
      headers: { Authorization: `Bearer ${access_token}` }
    });
    if (!data || !data.item) return res.json({});
    res.json({
      track: {
        name: data.item.name,
        artist: data.item.artists.map(a => a.name).join(', '),
        image: data.item.album.images[0]?.url
      }
    });
  } catch (err) {
    console.error('Current playback error:', err.response?.data || err.message);
    res.json({});
  }
});

// --- Playback Control Endpoint ---
app.post('/control', async (req, res) => {
  const { action } = req.body;
  let endpoint = '';
  if (action === 'next') {
    endpoint = 'https://api.spotify.com/v1/me/player/next';
  } else if (action === 'previous') {
    endpoint = 'https://api.spotify.com/v1/me/player/previous';
  } else {
    return res.status(400).send('Invalid action.');
  }
  try {
    await axios({
      method: 'POST',
      url: endpoint,
      headers: { Authorization: `Bearer ${access_token}` }
    });
    res.status(204).end();
  } catch (err) {
    console.error(`Playback control failed (${action}):`, err.response?.data || err.message);
    res.status(500).send('Playback control failed.');
  }
});

// --- Listening History Endpoint ---
app.get('/listening-history', (req, res) => {
  if (!fs.existsSync(csvFile)) return res.json([]);
  const data = fs.readFileSync(csvFile, 'utf8');
  const [header, ...rows] = data.trim().split('\n');
  const keys = header.split(',');
  const result = rows.map(row => {
    const values = row.split(',');
    return Object.fromEntries(keys.map((k, i) => [k, values[i] || '']));
  });
  res.json(result);
});

// --- User Mood Endpoint ---
app.get('/user-mood', (req, res) => {
  if (!fs.existsSync(moodCsv)) return res.json({ user_mood: 'Unknown', date: null, day: null, time: null });
  const data = fs.readFileSync(moodCsv, 'utf8');
  const [header, ...rows] = data.trim().split('\n');
  const keys = header.split(',');
  const dateIdx = keys.findIndex(k => k.toLowerCase().includes('date'));
  const dayIdx = keys.findIndex(k => k.toLowerCase().includes('day'));
  const slotIdx = keys.findIndex(
    k => k.toLowerCase().includes('slot') || k.toLowerCase().includes('time of day')
  );
  const moodIdx = keys.findIndex(k => k.toLowerCase().includes('mood'));
  if (dateIdx === -1 || slotIdx === -1 || moodIdx === -1 || dayIdx === -1) return res.json({ user_mood: 'Unknown', date: null, day: null, time: null });

  // Get current date and time slot
  const now = new Date();
  const hours = now.getHours();
  let slot = '';
  if (hours >= 6 && hours < 10) slot = 'morning';
  else if (hours >= 10 && hours < 14) slot = 'afternoon';
  else if (hours >= 14 && hours < 18) slot = 'evening';
  else if (hours >= 18 && hours < 22) slot = 'night';
  else slot = 'night'; // fallback for late night/early morning
  // Format date as DD-MM-YYYY to match CSV
  const today = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth()+1).padStart(2, '0')}-${now.getFullYear()}`;

  // Debug logging
  //console.log('DEBUG /user-mood: Looking for date =', today, ', slot =', slot);
  //rows.slice().reverse().forEach(row => {
    //const cols = row.split(',');
    //console.log('  Row:', {
      //date: (cols[dateIdx] || '').trim(),
      //slot: (cols[slotIdx] || '').trim().toLowerCase(),
      //mood: (cols[moodIdx] || '').replace(/"/g, '').trim()
    //});
  //});

  // Find the latest row for today and current slot (robust matching)
  const match = rows.reverse().find(row => {
    const cols = row.split(',');
    const rowDate = (cols[dateIdx] || '').trim();
    const rowSlot = (cols[slotIdx] || '').trim().toLowerCase();
    return rowDate === today && rowSlot === slot;
  });
  if (match) {
    const cols = match.split(',');
    return res.json({
      user_mood: (cols[moodIdx] || '').replace(/"/g, '').trim(),
      date: (cols[dateIdx] || '').trim(),
      day: (cols[dayIdx] || '').trim(),
      time: (cols[slotIdx] || '').trim()
    });
  }
  res.json({ user_mood: 'Unknown', date: today, day: null, time: slot });
});

// --- Mood Distribution Endpoint ---
app.get('/mood-distribution', (req, res) => {
  if (!fs.existsSync(moodCsv)) return res.json({ moods: [], records: [] });
  const data = fs.readFileSync(moodCsv, 'utf8');
  const [header, ...rows] = data.trim().split('\n');
  const keys = header.split(',');
  const dateIdx = keys.findIndex(k => k.toLowerCase().includes('date'));
  const dayIdx = keys.findIndex(k => k.toLowerCase().includes('day'));
  const slotIdx = keys.findIndex(k => k.toLowerCase().includes('slot') || k.toLowerCase().includes('time of day'));
  const moodIdx = keys.findIndex(k => k.toLowerCase().includes('mood'));
  if (moodIdx === -1) return res.json({ moods: [], records: [] });
  const lastRows = rows.slice(-20);
  const moods = lastRows.map(row => row.split(',')[moodIdx].replace(/"/g, '').trim());
  const records = lastRows.map(row => {
    const cols = row.split(',');
    return {
      date: (cols[dateIdx] || '').trim(),
      day: (cols[dayIdx] || '').trim(),
      time: (cols[slotIdx] || '').trim(),
      mood: (cols[moodIdx] || '').replace(/"/g, '').trim()
    };
  });
  res.json({ moods, records });
});

// --- Suggestions Endpoint ---
app.get('/suggestions', async (req, res) => {
  let mood = 'happyenergetic';
  try {
    const moodRes = await axios.get('http://127.0.0.1:8888/user-mood');
    mood = moodRes.data.user_mood?.toLowerCase().replace(/\s|\+|_|and/g, '') || mood;
  } catch {}
  let suggestions = [];
  if (fs.existsSync(transitionsCsv)) {
    const data = fs.readFileSync(transitionsCsv, 'utf8');
    const [header, ...rows] = data.trim().split('\n');
    const moods = header.split(',').map(h => h.trim().toLowerCase().replace(/\s|\+|_|and/g, ''));
    const moodColIdx = moods.findIndex(m => m === mood);
    if (moodColIdx !== -1) {
      suggestions = rows.map(row => {
        const cols = row.split(',');
        return (cols[moodColIdx] || '').replace(/"/g, '').trim();
      }).filter(s => s);
    }
  }
  res.json({ mood, suggestions: suggestions.length ? suggestions : ['Try something new!'] });
});

// --- Top Songs Endpoint ---
app.get('/top-songs', (req, res) => {
  const mood = req.query.mood || 'Happy';
  const csvPath = path.join(__dirname, 'listening_history.csv');
  if (!fs.existsSync(csvPath)) return res.json({ songs: [] });
  const data = fs.readFileSync(csvPath, 'utf8');
  const [header, ...rows] = data.trim().split('\n');
  const keys = header.split(',');
  const songIdx = keys.indexOf('Song Name');
  const artistIdx = keys.indexOf('Artist(s)');
  const moodIdx = keys.indexOf('Mood_Name');
  if (songIdx === -1 || artistIdx === -1) return res.json({ songs: [] });

  // Normalize mood for robust matching
  function normalizeMood(str) {
    return (str || '')
      .toLowerCase()
      .replace(/\s|\+|_|and/gi, '');
  }
  const normQueryMood = normalizeMood(mood);

  // Filter by normalized mood, count occurrences
  const songCounts = {};
  rows.forEach(row => {
    const cols = row.split(',');
    const song = (cols[songIdx] || '').replace(/"/g, '').trim();
    const artist = (cols[artistIdx] || '').replace(/"/g, '').trim();
    const moodName = moodIdx !== -1 ? (cols[moodIdx] || '').replace(/"/g, '').trim() : '';
    const normCsvMood = normalizeMood(moodName);
    // Match if moods are equivalent or one contains the other
    if (
      normCsvMood === normQueryMood ||
      normCsvMood.includes(normQueryMood) ||
      normQueryMood.includes(normCsvMood)
    ) {
      const key = `${song} - ${artist}`;
      songCounts[key] = (songCounts[key] || 0) + 1;
    }
  });
  const topSongs = Object.entries(songCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([key]) => {
      const [title, artist] = key.split(' - ');
      return { title, artist };
    });
  res.json({ mood, songs: topSongs });
});

// --- Weekly Trends Endpoint ---
app.get('/trends/weekly', (req, res) => {
  // Always return the current week (Sunday to Saturday)
  const moodCsvPath = path.join(__dirname, 'csvs', 'time+day+mood.csv');
  let rows = [];
  if (fs.existsSync(moodCsvPath)) {
    const data = fs.readFileSync(moodCsvPath, 'utf8');
    const [header, ...rest] = data.trim().split('\n');
    rows = rest;
  }
  // Get today and start of week (Sunday)
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay()); // Sunday
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });
  // CSV column indices
  let dateIdx = 0, timeIdx = 2, moodIdx = 3;
  if (rows.length > 0) {
    const header = 'Date,Day,Time of Day,Mood';
    const keys = header.split(',');
    dateIdx = keys.findIndex(k => k.toLowerCase().includes('date'));
    timeIdx = keys.findIndex(k => k.toLowerCase().includes('time'));
    moodIdx = keys.findIndex(k => k.toLowerCase().includes('mood'));
  }
  function normalizeMood(mood) {
    const m = (mood || '').toLowerCase().replace(/\s|\+/g, '');
    if (m === 'happycalm') return 'Happy + Calm';
    if (m === 'happyenergetic') return 'Happy + Energetic';
    if (m === 'sadcalm') return 'Sad + Calm';
    if (m === 'sadenergetic') return 'Sad + Energetic';
    return '';
  }
  const week = weekDays.map(d => {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const csvDate = `${dd}-${mm}-${yyyy}`;
    const isoDay = d.toISOString().slice(0, 10);
    const dayOfWeek = d.toLocaleDateString('en-US', { weekday: 'short' });
    const sections = {};
    ['morning', 'afternoon', 'evening', 'night'].forEach(section => {
      const found = rows.find(row => {
        const cols = row.split(',');
        return (cols[dateIdx] || '').trim() === csvDate && (cols[timeIdx] || '').trim().toLowerCase() === section;
      });
      const moodRaw = found ? (found.split(',')[moodIdx] || '').replace(/"/g, '').trim() : '';
      sections[section] = normalizeMood(moodRaw);
    });
    return { day: isoDay, sections, dayOfWeek };
  });
  res.json({ week });
});

// --- Trends Day Data Endpoint ---
app.get('/trends/day', (req, res) => {
  // Expects ?date=YYYY-MM-DD or DD-MM-YYYY
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'No date provided' });
  const moodCsvPath = path.join(__dirname, 'csvs', 'time+day+mood.csv');
  if (!fs.existsSync(moodCsvPath)) return res.json({ date, data: {} });
  const data = fs.readFileSync(moodCsvPath, 'utf8');
  const [header, ...rows] = data.trim().split('\n');
  const keys = header.split(',');
  const dateIdx = keys.findIndex(k => k.toLowerCase().includes('date'));
  const timeIdx = keys.findIndex(k => k.toLowerCase().includes('time'));
  const moodIdx = keys.findIndex(k => k.toLowerCase().includes('mood'));
  // Accept both YYYY-MM-DD and DD-MM-YYYY
  let formattedDate = date;
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    // Convert to DD-MM-YYYY
    const [yyyy, mm, dd] = date.split('-');
    formattedDate = `${dd}-${mm}-${yyyy}`;
  }
  const sections = ['morning', 'afternoon', 'evening', 'night'];
  function normalizeMood(mood) {
    const m = (mood || '').toLowerCase().replace(/\s|\+/g, '');
    if (m === 'happycalm') return 'Happy + Calm';
    if (m === 'happyenergetic') return 'Happy + Energetic';
    if (m === 'sadcalm') return 'Sad + Calm';
    if (m === 'sadenergetic') return 'Sad + Energetic';
    return '';
  }
  const moodsBySection = {};
  for (const section of sections) {
    const found = rows.find(row => {
      const cols = row.split(',');
      return (cols[dateIdx] || '').trim() === formattedDate && (cols[timeIdx] || '').trim().toLowerCase() === section;
    });
    const moodRaw = found ? (found.split(',')[moodIdx] || '').replace(/"/g, '').trim() : '';
    moodsBySection[section] = normalizeMood(moodRaw);
    console.log(`[trends/day] ${section}:`, { formattedDate, moodRaw, normalized: moodsBySection[section] });
  }
  console.log('[trends/day] moodsBySection:', moodsBySection);
  res.json({ date, data: moodsBySection });
});

// --- Trends Notes from time+note+day+date.csv Endpoint ---
const notesCsvPath = path.join(__dirname, 'csvs', 'time+note+day+date.csv');
app.get('/trends/notes', (req, res) => {
  // ?date=YYYY-MM-DD or DD-MM-YYYY
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'No date provided' });
  if (!fs.existsSync(notesCsvPath)) return res.json({ notes: [] });
  const data = fs.readFileSync(notesCsvPath, 'utf8');
  const [header, ...rows] = data.trim().split('\n');
  const keys = header.split(',');
  const dateIdx = keys.findIndex(k => k.toLowerCase().includes('date'));
  const timeIdx = keys.findIndex(k => k.toLowerCase().includes('time'));
  const noteIdx = keys.findIndex(k => k.toLowerCase().includes('note'));
  // Accept both YYYY-MM-DD and DD-MM-YYYY
  let formattedDate = date;
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    // Convert to DD-MM-YYYY
    const [yyyy, mm, dd] = date.split('-');
    formattedDate = `${dd}-${mm}-${yyyy}`;
  }
  const notes = rows.map(row => {
    const cols = row.split(',');
    return {
      date: (cols[dateIdx] || '').trim(),
      time: (cols[timeIdx] || '').trim(),
      note: (cols[noteIdx] || '').replace(/"/g, '').trim()
    };
  }).filter(n => n.date === formattedDate);
  res.json({ notes });
});

// --- Trends Monthly Endpoint ---
app.get('/trends/monthly', (req, res) => {
  // Accept ?month=6&year=2025 (month is 1-based)
  let { month, year } = req.query;
  const now = new Date();
  month = month ? parseInt(month, 10) : now.getMonth() + 1;
  year = year ? parseInt(year, 10) : now.getFullYear();
  // Get number of days in the month
  const daysInMonth = new Date(year, month, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const d = new Date(year, month - 1, i + 1);
    return d.toISOString().slice(0, 10);
  });
  const moods = ['Happy', 'Sad', 'Energetic', 'Calm'];
  const sections = ['morning', 'afternoon', 'evening', 'night'];
  const monthArr = days.map(day => ({
    day,
    sections: Object.fromEntries(sections.map(s => [s, moods[Math.floor(Math.random() * moods.length)]]))
  }));
  res.json({ month: monthArr });
});

// --- Start Server ---
app.listen(8888, '127.0.0.1', () => {
  console.log('Server running at http://127.0.0.1:8888');
}); 
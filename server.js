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
app.get('/weekly-trends', (req, res) => {
  const csvPath = path.join(__dirname, 'ML', 'user_mood_history.csv');
  if (!fs.existsSync(csvPath)) return res.json({ trends: [] });
  const data = fs.readFileSync(csvPath, 'utf8');
  const [header, ...rows] = data.trim().split('\n');
  const keys = header.split(',');
  const moodIdx = keys.indexOf('User_Mood');
  const timeIdx = keys.indexOf('Timestamp');
  if (moodIdx === -1 || timeIdx === -1) return res.json({ trends: [] });
  // Group by day
  const trendsByDay = {};
  rows.forEach(row => {
    const cols = row.split(',');
    const date = cols[timeIdx].slice(0, 10);
    const mood = cols[moodIdx].replace(/"/g, '').trim();
    if (!trendsByDay[date]) trendsByDay[date] = {};
    trendsByDay[date][mood] = (trendsByDay[date][mood] || 0) + 1;
  });
  // Format as list
  const trends = Object.entries(trendsByDay).map(([date, moods]) => {
    const moodStr = Object.entries(moods).map(([m, c]) => `${m}: ${c}`).join(', ');
    return { date, summary: moodStr, moods };
  });
  res.json({ trends });
});

// --- Reflections Endpoint ---
app.get('/reflections', (req, res) => {
  if (!fs.existsSync(notesCsv)) return res.json({ reflections: [] });
  const data = fs.readFileSync(notesCsv, 'utf8');
  const [header, ...rows] = data.trim().split('\n');
  const keys = header.split(',');
  const dateIdx = keys.findIndex(k => k.toLowerCase().includes('date'));
  const dayIdx = keys.findIndex(k => k.toLowerCase().includes('day'));
  const slotIdx = keys.findIndex(k => k.toLowerCase().includes('slot') || k.toLowerCase().includes('time of day'));
  const noteIdx = keys.findIndex(k => k.toLowerCase().includes('note'));
  const reflections = rows.map(row => {
    const cols = row.split(',');
    return {
      date: (cols[dateIdx] || '').trim(),
      day: (cols[dayIdx] || '').trim(),
      time: (cols[slotIdx] || '').trim(),
      note: (cols[noteIdx] || '').replace(/"/g, '').trim()
    };
  });
  res.json({ reflections });
});

app.post('/reflections', (req, res) => {
  const { reflection, date, day, time } = req.body;
  if (!reflection || !date || !day || !time) return res.status(400).json({ error: 'Missing reflection or context fields' });
  let csvData = '';
  if (fs.existsSync(notesCsv)) {
    csvData = fs.readFileSync(notesCsv, 'utf8');
  } else {
    fs.writeFileSync(notesCsv, 'Date,Day,Time of Day,Short Notes\n', 'utf8');
    csvData = 'Date,Day,Time of Day,Short Notes\n';
  }
  const lines = csvData.trim().split('\n');
  const header = lines[0];
  let updated = false;
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if ((cols[0] || '').replace(/"/g, '').trim() === date &&
        (cols[1] || '').replace(/"/g, '').trim() === day &&
        (cols[2] || '').replace(/"/g, '').trim() === time) {
      // Append to existing note
      const existingNote = (cols[3] || '').replace(/"/g, '').trim();
      const newNote = existingNote ? `${existingNote} | ${reflection}` : reflection;
      lines[i] = `${date},${day},${time},${newNote}`;
      updated = true;
      break;
    }
  }
  if (!updated) {
    lines.push(`${date},${day},${time},${reflection}`);
  }
  fs.writeFileSync(notesCsv, lines.join('\n') + '\n', 'utf8');
  res.json({ success: true });
});

// --- Background Poller ---
let currentTrackId = null;
let alreadyLogged = false;
const trackPlayInfo = new Map(); // trackId -> { lastLogged: Date, playStart: Date, accumulated: number }

async function pollSpotify() {
  if (!access_token) return; // Not authenticated yet
  // Refresh token if needed
  try {
    const data = await spotifyApi.refreshAccessToken();
    access_token = data.body['access_token'];
    spotifyApi.setAccessToken(access_token);
  } catch (e) {
    // Ignore if refresh fails (will try again next time)
  }
  try {
    const playback = await spotifyApi.getMyCurrentPlaybackState();
    if (playback.body && playback.body.is_playing && playback.body.item) {
      const track = playback.body.item;
      const trackId = track.id;
      const songName = track.name;
      const artistList = track.artists.map(a => a.name);
      const artistStr = artistList.join(', ');
      const now = Date.now();
      // Track play info
      let info = trackPlayInfo.get(trackId);
      if (!info) {
        info = { lastLogged: 0, playStart: now, accumulated: 0 };
        trackPlayInfo.set(trackId, info);
      }
      // If track changed, reset playStart
      if (trackId !== currentTrackId) {
        currentTrackId = trackId;
        alreadyLogged = false;
        info.playStart = now;
        info.accumulated = 0;
      }
      // Accumulate play time
      info.accumulated += 5; // 5 seconds per poll
      // Only log if played for at least 60s and not logged in last 60s
      if (!alreadyLogged && info.accumulated >= 60 && (now - info.lastLogged > 60000)) {
        alreadyLogged = true;
        info.lastLogged = now;
        info.accumulated = 0;
        const timeListened = new Date().toISOString().replace('T', ' ').slice(0, 19);
        // Find local MP3
        let foundFilePath = null;
        const sanitizedSong = sanitize(songName);
        const sanitizedArtists = artistList.map(sanitize);
        if (fs.existsSync(playlistFolder)) {
          for (const file of fs.readdirSync(playlistFolder)) {
            if (file.toLowerCase().endsWith('.mp3')) {
              const filename = sanitize(file.replace('.mp3', ''));
              const songInFile = sanitizedSong.split('from')[0].trim();
              const songMatch = filename.includes(songInFile) || filename.includes(sanitizedSong);
              const artistMatch = sanitizedArtists.some(a => filename.includes(a));
              if (songMatch && artistMatch) {
                foundFilePath = path.join(playlistFolder, file);
                break;
              }
            }
          }
        }
        if (foundFilePath) {
          console.log(`🎵 Found local file: ${foundFilePath}`);
          await analyzeChunks(foundFilePath, { songName, artistStr, timeListened });
        } else {
          console.log('❌ No matching local MP3 found.');
        }
      }
    } else {
      currentTrackId = null;
      alreadyLogged = false;
    }
  } catch (e) {
    console.error('Spotify poll error:', e.message);
  }
}
setInterval(pollSpotify, 5000);

// --- Trends Day Data Endpoint ---
app.get('/trends/day', (req, res) => {
  // Expects ?date=YYYY-MM-DD
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'No date provided' });
  // Example: read from trends_day.csv or build from classified_songs.csv
  // For demo, return random moods
  const sections = ['morning', 'afternoon', 'evening', 'night'];
  const moods = ['Happy', 'Sad', 'Energetic', 'Calm'];
  const data = {};
  sections.forEach(section => {
    data[section] = {
      mood: moods[Math.floor(Math.random() * moods.length)],
      notes: ''
    };
  });
  res.json({ date, data });
});

// --- Trends Notes Endpoint ---
const notesPath = path.join(__dirname, 'trends_notes.csv');
app.get('/trends/notes', (req, res) => {
  // ?date=YYYY-MM-DD&section=morning
  const { date, section } = req.query;
  if (!date || !section) return res.status(400).json({ error: 'Missing params' });
  if (!fs.existsSync(notesPath)) return res.json({ note: '' });
  const data = fs.readFileSync(notesPath, 'utf8');
  const [header, ...rows] = data.trim().split('\n');
  for (const row of rows) {
    const [rowDate, rowSection, note] = row.split(/,(.+)/);
    if (rowDate === date && rowSection === section) {
      return res.json({ note });
    }
  }
  res.json({ note: '' });
});
app.post('/trends/notes', (req, res) => {
  const { date, section, note } = req.body;
  if (!date || !section || !note) return res.status(400).json({ error: 'Missing params' });
  if (!fs.existsSync(notesPath)) {
    fs.writeFileSync(notesPath, 'date,section,note\n', 'utf8');
  }
  fs.appendFileSync(notesPath, `"${date}","${section}","${note.replace(/"/g, '""')}"\n`, 'utf8');
  res.json({ success: true });
});

// --- Trends Weekly Endpoint ---
app.get('/trends/weekly', (req, res) => {
  // Return array of { day: '2025-07-01', sections: { morning: 'Happy', ... } }
  // For demo, generate random data
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  });
  const moods = ['Happy', 'Sad', 'Energetic', 'Calm'];
  const sections = ['morning', 'afternoon', 'evening', 'night'];
  const week = days.map(day => ({
    day,
    sections: Object.fromEntries(sections.map(s => [s, moods[Math.floor(Math.random() * moods.length)]]))
  }));
  res.json({ week });
});

// --- Trends Monthly Endpoint ---
app.get('/trends/monthly', (req, res) => {
  // Return array of { day: '2025-07-01', sections: { ... } }
  // For demo, generate random data for 30 days
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(1 + i);
    return d.toISOString().slice(0, 10);
  });
  const moods = ['Happy', 'Sad', 'Energetic', 'Calm'];
  const sections = ['morning', 'afternoon', 'evening', 'night'];
  const month = days.map(day => ({
    day,
    sections: Object.fromEntries(sections.map(s => [s, moods[Math.floor(Math.random() * moods.length)]]))
  }));
  res.json({ month });
});

// --- Start Server ---
app.listen(8888, '127.0.0.1', () => {
  console.log('Server running at http://127.0.0.1:8888');
}); 
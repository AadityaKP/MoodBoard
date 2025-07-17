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

const playlistFolder = path.join(__dirname, '..', 'UserPlaylist');
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
let currentTrack = null;
let analysisInProgress = false;

// --- Spotify API Client ---
const spotifyApi = new SpotifyWebApi({
  clientId: client_id,
  clientSecret: client_secret,
  redirectUri: redirect_uri
});

// --- In-memory lock to prevent concurrent analysis of the same song ---
const analysisLock = {};

// --- In-memory tracker for last analyzed song and its end time ---
let lastAnalyzed = {
  song: null,      // sanitized song name
  artist: null,    // sanitized artist string
  endTime: 0       // timestamp in ms when the song finished
};

// --- Helper: Sanitize String ---
function sanitize(name) {
  return name
    .normalize('NFKD')
    .replace(/["'""'']/g, '')
    .replace(/[^a-zA-Z0-9 \-_]/g, '')
    .trim()
    .toLowerCase();
}

// --- Helper: Robust CSV Row Parser ---
function parseCsvRow(row) {
  // Split on commas not inside quotes
  const regex = /(?:"([^"]*)")|([^,]+)/g;
  const cols = [];
  let match;
  while ((match = regex.exec(row)) !== null) {
    cols.push(match[1] !== undefined ? match[1] : match[2]);
  }
  return cols;
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

// --- Helper: Get Current Time Slot ---
function getCurrentTimeSlot() {
  const hours = new Date().getHours();
  if (hours >= 6 && hours < 10) return 'morning';
  else if (hours >= 10 && hours < 14) return 'afternoon';
  else if (hours >= 14 && hours < 18) return 'evening';
  else return 'night';
}

// --- Helper: Get Current Date ---
function getCurrentDate() {
  const now = new Date();
  return `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth()+1).padStart(2, '0')}-${now.getFullYear()}`;
}

// --- Helper: Update or Add Song Mood (in-place frequency update, with sanitization) ---
function updateOrAddSongMood(songName, artistStr, finalMood) {
  const songMoodPath = path.join(CSVS_DIR, 'song_mood.csv');
  if (!fs.existsSync(songMoodPath)) {
    fs.writeFileSync(songMoodPath, 'Song Name,Artist,Final Mood,Frequency\n', 'utf8');
  }
  const data = fs.readFileSync(songMoodPath, 'utf8');
  const lines = data.trim().split('\n');
  const [header, ...rows] = lines;
  const keys = header.split(',');
  const songIdx = keys.indexOf('Song Name');
  const artistIdx = keys.indexOf('Artist');
  const moodIdx = keys.indexOf('Final Mood');
  const freqIdx = keys.indexOf('Frequency');

  const sanitizedSongName = sanitize(songName);
  const sanitizedArtistStr = sanitize(artistStr);

  let found = false;
  const updatedRows = rows.map(row => {
    const cols = parseCsvRow(row);
    const csvSong = sanitize((cols[songIdx] || '').trim());
    const csvArtist = sanitize((cols[artistIdx] || '').trim());
    if (csvSong === sanitizedSongName && csvArtist === sanitizedArtistStr) {
      found = true;
      cols[freqIdx] = (parseInt(cols[freqIdx] || '1', 10) + 1).toString();
      // Optionally update mood if you want to allow it to change
      // if (finalMood && finalMood !== 'null') cols[moodIdx] = `"${finalMood}"`;
    }
    // Re-quote all fields for CSV output
    return cols.map((c, i) => i === freqIdx ? c : `"${c}"`).join(',');
  });

  if (found) {
    fs.writeFileSync(songMoodPath, [header, ...updatedRows].join('\n') + '\n', 'utf8');
  } else if (finalMood && finalMood !== 'null') {
    // Add new entry only if finalMood is valid
    const row = `"${songName}","${artistStr}","${finalMood}",1\n`;
    fs.appendFileSync(songMoodPath, row, 'utf8');
  }
}

// --- Helper: Check if Song Already Analyzed (with sanitization, robust CSV parsing) ---
function isSongAlreadyAnalyzed(songName, artistStr) {
  const songMoodPath = path.join(CSVS_DIR, 'song_mood.csv');
  if (!fs.existsSync(songMoodPath)) return false;
  const data = fs.readFileSync(songMoodPath, 'utf8');
  const [header, ...rows] = data.trim().split('\n');
  const songIdx = header.split(',').indexOf('Song Name');
  const artistIdx = header.split(',').indexOf('Artist');
  const sanitizedSongName = sanitize(songName);
  const sanitizedArtistStr = sanitize(artistStr);
  const found = rows.some(row => {
    const cols = parseCsvRow(row);
    const csvSong = sanitize((cols[songIdx] || '').trim());
    const csvArtist = sanitize((cols[artistIdx] || '').trim());
    const match = csvSong === sanitizedSongName && csvArtist === sanitizedArtistStr;
    if (match) {
      console.log(`[isSongAlreadyAnalyzed] Found in CSV: song='${sanitizedSongName}', artist='${sanitizedArtistStr}', row='${row}'`);
    }
    return match;
  });
  return found;
}

// --- Helper: Update Song Frequency ---
function updateSongFrequency(songName, artistStr) {
  const songMoodPath = path.join(CSVS_DIR, 'song_mood.csv');
  if (!fs.existsSync(songMoodPath)) return;
  
  const data = fs.readFileSync(songMoodPath, 'utf8');
  const lines = data.trim().split('\n');
  const [header, ...rows] = lines;
  const keys = header.split(',');
  const songIdx = keys.indexOf('Song Name');
  const artistIdx = keys.indexOf('Artist');
  const freqIdx = keys.indexOf('Frequency');
  
  const updatedRows = rows.map(row => {
    const cols = row.split(',');
    const csvSong = sanitize((cols[songIdx] || '').replace(/"/g, '').trim());
    const csvArtist = sanitize((cols[artistIdx] || '').replace(/"/g, '').trim());
    
    if (csvSong === songName && csvArtist === artistStr) {
      const currentFreq = parseInt(cols[freqIdx] || '0', 10);
      cols[freqIdx] = currentFreq + 1;
    }
    return cols.join(',');
  });
  
  fs.writeFileSync(songMoodPath, [header, ...updatedRows].join('\n') + '\n', 'utf8');
}

// --- Helper: Add to Listening History ---
function addToListeningHistory(songName, artistStr) {
  const listeningHistoryPath = path.join(CSVS_DIR, 'listening_history.csv');
  const timeSlot = getCurrentTimeSlot();
  const date = getCurrentDate();
  
  // Create file with headers if it doesn't exist
  if (!fs.existsSync(listeningHistoryPath)) {
    fs.writeFileSync(listeningHistoryPath, 'Song Name,Artist,Time of Day,Date\n', 'utf8');
  }
  
  const row = `"${songName}","${artistStr}","${timeSlot}","${date}"\n`;
  fs.appendFileSync(listeningHistoryPath, row, 'utf8');
}

// --- Helper: Add to Song Chunk Analysis ---
function addToSongChunkAnalysis(songName, chunkNumber, features) {
  const chunkAnalysisPath = path.join(CSVS_DIR, 'song_chunk_analysis.csv');
  // Create file with headers if it doesn't exist
  if (!fs.existsSync(chunkAnalysisPath)) {
    const headers = ['Song Name', 'Chunk Number', 'danceability', 'energy', 'loudness', 'speechiness', 'acousticness', 'instrumentalness', 'liveness', 'valence', 'tempo'];
    fs.writeFileSync(chunkAnalysisPath, headers.join(',') + '\n', 'utf8');
  }
  const row = [
    `"${sanitize(songName)}"`,
    chunkNumber,
    features.danceability,
    features.energy,
    features.loudness,
    features.speechiness,
    features.acousticness,
    features.instrumentalness,
    features.liveness,
    features.valence,
    features.tempo
  ].join(',') + '\n';
  fs.appendFileSync(chunkAnalysisPath, row, 'utf8');
}

// --- Helper: Add to Song Chunk Mood ---
function addToSongChunkMood(songName, chunkNumber, mood) {
  const chunkMoodPath = path.join(CSVS_DIR, 'song_chunk_mood.csv');
  // Create file with headers if it doesn't exist
  if (!fs.existsSync(chunkMoodPath)) {
    fs.writeFileSync(chunkMoodPath, 'Song Name,Chunk Number,Mood\n', 'utf8');
  }
  const row = `"${sanitize(songName)}",${chunkNumber},"${mood}"\n`;
  fs.appendFileSync(chunkMoodPath, row, 'utf8');
}

// --- Helper: Aggregate Song Mood ---
function aggregateSongMood(songName, artistStr) {
  const chunkMoodPath = path.join(CSVS_DIR, 'song_chunk_mood.csv');
  if (!fs.existsSync(chunkMoodPath)) return 'Unknown';
  
  const data = fs.readFileSync(chunkMoodPath, 'utf8');
  const [header, ...rows] = data.trim().split('\n');
  const keys = header.split(',');
  const songIdx = keys.indexOf('Song Name');
  const moodIdx = keys.indexOf('Mood');
  
  // Get all moods for this song
  const songMoods = rows
    .map(row => {
      const cols = row.split(',');
      const csvSong = sanitize((cols[songIdx] || '').replace(/"/g, '').trim());
      return csvSong === sanitize(songName) ? (cols[moodIdx] || '').replace(/"/g, '').trim() : null;
    })
    .filter(mood => mood && mood !== 'Unknown');
  
  if (songMoods.length === 0) return 'Unknown';
  
  // Use the same aggregation logic as in mood_aggr_class.py
  const valenceMoods = songMoods.filter(mood => ['Happy', 'Sad'].includes(mood));
  const arousalMoods = songMoods.filter(mood => ['Calm', 'Energetic'].includes(mood));
  
  const finalValence = valenceMoods.length > 0 ? 
    valenceMoods.reduce((acc, mood) => {
      acc[mood] = (acc[mood] || 0) + 1;
      return acc;
    }, {}) : {};
  
  const finalArousal = arousalMoods.length > 0 ? 
    arousalMoods.reduce((acc, mood) => {
      acc[mood] = (acc[mood] || 0) + 1;
      return acc;
    }, {}) : {};
  
  const moodParts = [];
  
  if (Object.keys(finalValence).length > 0) {
    const maxValence = Object.entries(finalValence).reduce((a, b) => finalValence[a[0]] > finalValence[b[0]] ? a : b);
    moodParts.push(maxValence[0]);
  }
  
  if (Object.keys(finalArousal).length > 0) {
    const maxArousal = Object.entries(finalArousal).reduce((a, b) => finalArousal[a[0]] > finalArousal[b[0]] ? a : b);
    moodParts.push(maxArousal[0]);
  }
  
  let finalMood = moodParts.join(' and ') || 'Unknown';
  
  // Relabel single moods
  if (finalMood === 'Sad') finalMood = 'Sad and Calm';
  else if (finalMood === 'Happy') finalMood = 'Happy and Energetic';
  
  return finalMood;
}

// --- Helper: Update User Mood ---
function updateUserMood() {
  const songMoodPath = path.join(CSVS_DIR, 'song_mood.csv');
  const listeningHistoryPath = path.join(CSVS_DIR, 'listening_history.csv');
  const userMoodPath = path.join(CSVS_DIR, 'user_mood.csv');
  
  if (!fs.existsSync(songMoodPath) || !fs.existsSync(listeningHistoryPath)) return;
  
  // Read song moods
  const songMoodData = fs.readFileSync(songMoodPath, 'utf8');
  const [songMoodHeader, ...songMoodRows] = songMoodData.trim().split('\n');
  const songMoodKeys = songMoodHeader.split(',');
  const songIdx = songMoodKeys.indexOf('Song Name');
  const artistIdx = songMoodKeys.indexOf('Artist');
  const moodIdx = songMoodKeys.indexOf('Final Mood');
  
  // Read listening history
  const historyData = fs.readFileSync(listeningHistoryPath, 'utf8');
  const [historyHeader, ...historyRows] = historyData.trim().split('\n');
  const historyKeys = historyHeader.split(',');
  const histSongIdx = historyKeys.indexOf('Song Name');
  const histArtistIdx = historyKeys.indexOf('Artist');
  const timeIdx = historyKeys.indexOf('Time of Day');
  const dateIdx = historyKeys.indexOf('Date');
  
  // Get current time slot and date
  const currentTimeSlot = getCurrentTimeSlot();
  const currentDate = getCurrentDate();
  
  // Find songs listened to in current time slot and date
  const currentSessionSongs = historyRows
    .map(row => {
      const cols = row.split(',');
      const song = sanitize((cols[histSongIdx] || '').replace(/"/g, '').trim());
      const artist = sanitize((cols[histArtistIdx] || '').replace(/"/g, '').trim());
      const time = sanitize((cols[timeIdx] || '').replace(/"/g, '').trim());
      const date = sanitize((cols[dateIdx] || '').replace(/"/g, '').trim());
      
      if (time === currentTimeSlot && date === currentDate) {
        // Find corresponding mood
        const moodRow = songMoodRows.find(moodRow => {
          const moodCols = moodRow.split(',');
          const moodSong = sanitize((moodCols[songIdx] || '').replace(/"/g, '').trim());
          const moodArtist = sanitize((moodCols[artistIdx] || '').replace(/"/g, '').trim());
          return moodSong === song && moodArtist === artist;
        });
        
        if (moodRow) {
          const moodCols = moodRow.split(',');
          const mood = (moodCols[moodIdx] || '').replace(/"/g, '').trim();
          console.log(`[updateUserMood] Found song in session: song='${song}', artist='${artist}', mood='${mood}'`);
          return mood;
        } else {
          console.log(`[updateUserMood] No mood found for song='${song}', artist='${artist}'`);
        }
      }
      return null;
    })
    .filter(mood => mood && mood !== 'Unknown');
  
  console.log(`[updateUserMood] Session moods:`, currentSessionSongs);
  if (currentSessionSongs.length === 0) {
    console.log('[updateUserMood] No valid moods found for current session. User mood will be Unknown.');
    return;
  }
  
  // Aggregate user mood using the same logic (case-insensitive)
  const valenceMoods = currentSessionSongs.filter(mood => mood.toLowerCase().includes('happy') || mood.toLowerCase().includes('sad'));
  const arousalMoods = currentSessionSongs.filter(mood => mood.toLowerCase().includes('calm') || mood.toLowerCase().includes('energetic'));
  
  console.log(`[updateUserMood] Valence moods:`, valenceMoods);
  console.log(`[updateUserMood] Arousal moods:`, arousalMoods);
  
  const finalValence = valenceMoods.length > 0 ? 
    valenceMoods.reduce((acc, mood) => {
      const valence = mood.toLowerCase().includes('happy') ? 'Happy' : 'Sad';
      acc[valence] = (acc[valence] || 0) + 1;
      return acc;
    }, {}) : {};
  
  const finalArousal = arousalMoods.length > 0 ? 
    arousalMoods.reduce((acc, mood) => {
      const arousal = mood.toLowerCase().includes('energetic') ? 'Energetic' : 'Calm';
      acc[arousal] = (acc[arousal] || 0) + 1;
      return acc;
    }, {}) : {};
  
  console.log(`[updateUserMood] Valence counts:`, finalValence);
  console.log(`[updateUserMood] Arousal counts:`, finalArousal);
  
  const moodParts = [];
  
  if (Object.keys(finalValence).length > 0) {
    const maxValence = Object.entries(finalValence).reduce((a, b) => finalValence[a[0]] > finalValence[b[0]] ? a : b);
    moodParts.push(maxValence[0]);
  }
  
  if (Object.keys(finalArousal).length > 0) {
    const maxArousal = Object.entries(finalArousal).reduce((a, b) => finalArousal[a[0]] > finalArousal[b[0]] ? a : b);
    moodParts.push(maxArousal[0]);
  }
  
  let userMood = moodParts.join(' and ') || 'Unknown';
  
  // Relabel single moods
  if (userMood === 'Sad') userMood = 'Sad and Calm';
  else if (userMood === 'Happy') userMood = 'Happy and Energetic';
  
  console.log(`[updateUserMood] Final user mood:`, userMood);
  // Create or update user mood file
  if (!fs.existsSync(userMoodPath)) {
    fs.writeFileSync(userMoodPath, 'Date,Time of Day,Final Mood\n', 'utf8');
  }
  
  // Check if entry already exists for current date and time
  const userMoodData = fs.readFileSync(userMoodPath, 'utf8');
  const [userMoodHeader, ...userMoodRows] = userMoodData.trim().split('\n');
  const userMoodKeys = userMoodHeader.split(',');
  const userDateIdx = userMoodKeys.indexOf('Date');
  const userTimeIdx = userMoodKeys.indexOf('Time of Day');
  
  const existingEntry = userMoodRows.findIndex(row => {
    const cols = row.split(',');
    const date = sanitize((cols[userDateIdx] || '').replace(/"/g, '').trim());
    const time = sanitize((cols[userTimeIdx] || '').replace(/"/g, '').trim());
    return date === currentDate && time === currentTimeSlot;
  });
  
  if (existingEntry !== -1) {
    // Update existing entry
    const updatedRows = userMoodRows.map((row, index) => {
      if (index === existingEntry) {
        const cols = row.split(',');
        cols[userMoodKeys.indexOf('Final Mood')] = `"${userMood}"`;
        return cols.join(',');
      }
      return row;
    });
    fs.writeFileSync(userMoodPath, [userMoodHeader, ...updatedRows].join('\n') + '\n', 'utf8');
  } else {
    // Add new entry
    const newRow = `"${currentDate}","${currentTimeSlot}","${userMood}"\n`;
    fs.appendFileSync(userMoodPath, newRow, 'utf8');
  }
}

// --- Helper: Fuzzy Find Song File (Python-style) ---
function findSongFile(songName, artistStr, playlistFolder) {
  const sanitizedSong = sanitize(songName).split('from')[0].trim();
  const sanitizedArtists = artistStr.split(',').map(a => sanitize(a));
  const files = fs.readdirSync(playlistFolder);

  for (const file of files) {
    if (file.toLowerCase().endsWith('.mp3')) {
      const filename = sanitize(file.replace('.mp3', ''));
      const songMatch = sanitizedSong && filename.includes(sanitizedSong);
      const artistMatch = sanitizedArtists.some(artist => filename.includes(artist));
      if (songMatch && artistMatch) {
        return path.join(playlistFolder, file);
      }
    }
  }
  return null;
}

// --- New Endpoint: Get Current Playback and Trigger Analysis ---
app.get('/current-playback-analysis', async (req, res) => {
  try {
    // Get current playback state
    const { data } = await axios.get('https://api.spotify.com/v1/me/player', {
      headers: { Authorization: `Bearer ${access_token}` }
    });
    
    if (!data || !data.item || !data.is_playing) {
      return res.json({ 
        status: 'no_playback',
        message: 'No active playback detected'
      });
    }
    
    const track = data.item;
    const progressMs = data.progress_ms || 0;
    const durationMs = track.duration_ms;
    const songName = track.name;
    const artistStr = track.artists.map(a => a.name).join(', ');
    
    const sanitizedSong = sanitize(songName);
    const sanitizedArtist = sanitize(artistStr);
    const now = Date.now();

    // Only analyze/log if:
    // - Played for at least 1 minute
    // - Not the same as last analyzed, or song restarted, or song finished and started again
    if (
      progressMs >= 60000 &&
      (
        lastAnalyzed.song !== sanitizedSong ||
        lastAnalyzed.artist !== sanitizedArtist ||
        progressMs < 10000 || // song restarted
        now > lastAnalyzed.endTime // song finished and started again
      )
    ) {
      // Update lastAnalyzed
      lastAnalyzed = {
        song: sanitizedSong,
        artist: sanitizedArtist,
        endTime: now + (durationMs - progressMs)
      };
      // Check if this is a new track or if we should analyze after 1 minute
      // For testing, you can force analysis by adding ?force=true to the URL
      const forceAnalysis = req.query.force === 'true';
      const shouldAnalyze = forceAnalysis || !currentTrack || 
        currentTrack.id !== track.id || 
        (progressMs >= 60000 && !analysisInProgress); // 1 minute = 60000ms
      
      if (shouldAnalyze && !analysisInProgress) {
        analysisInProgress = true;
        
        // Replace strict lookup with fuzzy search
        const mp3Path = findSongFile(songName, artistStr, playlistFolder);
        const lockKey = `${sanitizedSong}::${sanitizedArtist}`;
        if (analysisLock[lockKey]) {
          return res.json({ status: 'analysis_in_progress' });
        }
        analysisLock[lockKey] = true;
        try {
          if (isSongAlreadyAnalyzed(songName, artistStr)) {
            // Only update frequency, do not re-analyze
            updateOrAddSongMood(songName, artistStr, null); // finalMood not needed for update
            addToListeningHistory(songName, artistStr);
            updateUserMood();
            currentTrack = {
              id: track.id,
              name: songName,
              artist: artistStr,
              analyzed: true,
              image: track.album?.images?.[0]?.url || null
            };
            analysisInProgress = false;
            analysisLock[lockKey] = false;
            return res.json({
              status: 'already_analyzed',
              track: {
                name: songName,
                artist: artistStr,
                progress: progressMs,
                duration: durationMs,
                image: track.album?.images?.[0]?.url || null
              },
              message: 'Song already analyzed, frequency updated'
            });
          }
          if (mp3Path && fs.existsSync(mp3Path)) {
            console.log(`🎵 Analyzing song: ${songName} by ${artistStr}`);
            // Analyze chunks
            await analyzeChunks(mp3Path, {
              songName,
              artistStr,
              timeListened: new Date().toISOString()
            });
            // Aggregate song mood
            const finalMood = aggregateSongMood(songName, artistStr);
            // Add or update song mood CSV (adds new entry)
            updateOrAddSongMood(songName, artistStr, finalMood);
            addToListeningHistory(songName, artistStr);
            updateUserMood();
            currentTrack = {
              id: track.id,
              name: songName,
              artist: artistStr,
              analyzed: true,
              mood: finalMood,
              image: track.album?.images?.[0]?.url || null
            };
            analysisInProgress = false;
            analysisLock[lockKey] = false;
            return res.json({
              status: 'analysis_complete',
              track: {
                name: songName,
                artist: artistStr,
                progress: progressMs,
                duration: durationMs,
                image: track.album?.images?.[0]?.url || null
              },
              mood: finalMood,
              message: 'Song analysis completed successfully'
            });
          } else {
            console.log(`⚠️ Song file not found: ${mp3Path || '[no match found]'}`);
            analysisInProgress = false;
            analysisLock[lockKey] = false;
            return res.json({
              status: 'file_not_found',
              track: {
                name: songName,
                artist: artistStr,
                progress: progressMs,
                duration: durationMs,
                image: track.album?.images?.[0]?.url || null
              },
              message: 'Song file not found in playlist folder'
            });
          }
        } finally {
          analysisLock[lockKey] = false;
        }
      } else {
        // Do not analyze or increment frequency if still in the same play session
        return res.json({
          status: 'already_logged_this_session',
          track: {
            name: songName,
            artist: artistStr,
            progress: progressMs,
            duration: durationMs,
            image: track.album?.images?.[0]?.url || null
          },
          message: 'Song already logged/analyzed for this play session.'
        });
      }
    } else {
      // Return current playback info without analysis
      return res.json({
        status: 'playback_info',
        track: {
          name: songName,
          artist: artistStr,
          progress: progressMs,
          duration: durationMs,
          image: track.album?.images?.[0]?.url || null
        },
        currentTrack: currentTrack,
        message: 'Playback info retrieved'
      });
    }
  } catch (err) {
    console.error('Current playback analysis error:', err.response?.data || err.message);
    res.status(500).json({
      status: 'error',
      error: err.message
    });
  }
});

// --- Modified analyzeChunks function to work with new CSV structure ---
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
    
    if (features) {
      // Add to song chunk analysis CSV
      addToSongChunkAnalysis(baseInfo.songName, i + 1, features);
      
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
        
        const moodName = response.data.mood;
        
        // Add to song chunk mood CSV
        addToSongChunkMood(baseInfo.songName, i + 1, moodName);
        
        console.log(`✅ Chunk ${i + 1} analyzed: ${moodName}`);
      } catch (err) {
        console.error('ML API mood prediction failed:', err.message);
        // Add unknown mood
        addToSongChunkMood(baseInfo.songName, i + 1, 'Unknown');
      }
    }
    
    // Clean up chunk file
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
  const listeningHistoryPath = path.join(CSVS_DIR, 'listening_history.csv');
  if (!fs.existsSync(listeningHistoryPath)) return res.json([]);
  const data = fs.readFileSync(listeningHistoryPath, 'utf8');
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
  const userMoodPath = path.join(CSVS_DIR, 'user_mood.csv');
  if (!fs.existsSync(userMoodPath)) return res.json({ user_mood: 'Unknown', date: null, day: null, time: null });
  
  const data = fs.readFileSync(userMoodPath, 'utf8');
  const [header, ...rows] = data.trim().split('\n');
  const keys = header.split(',');
  const dateIdx = keys.findIndex(k => k.toLowerCase().includes('date'));
  const slotIdx = keys.findIndex(k => k.toLowerCase().includes('time of day'));
  const moodIdx = keys.findIndex(k => k.toLowerCase().includes('mood'));
  
  if (dateIdx === -1 || slotIdx === -1 || moodIdx === -1) {
    return res.json({ user_mood: 'Unknown', date: null, day: null, time: null });
  }

  // Get current date and time slot
  const now = new Date();
  const currentTimeSlot = getCurrentTimeSlot();
  const currentDate = getCurrentDate();
  const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' });

  // Find the latest row for today and current slot
  const match = rows.reverse().find(row => {
    const cols = row.split(',');
    const rowDate = (cols[dateIdx] || '').replace(/"/g, '').trim();
    const rowSlot = (cols[slotIdx] || '').replace(/"/g, '').trim().toLowerCase();
    return rowDate === currentDate && rowSlot === currentTimeSlot;
  });
  
  if (match) {
    const cols = match.split(',');
    return res.json({
      user_mood: (cols[moodIdx] || '').replace(/"/g, '').trim(),
      date: (cols[dateIdx] || '').replace(/"/g, '').trim(),
      day: dayOfWeek,
      time: (cols[slotIdx] || '').replace(/"/g, '').trim()
    });
  }
  
  res.json({ user_mood: 'Unknown', date: currentDate, day: dayOfWeek, time: currentTimeSlot });
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
  const songMoodPath = path.join(CSVS_DIR, 'song_mood.csv');
  if (!fs.existsSync(songMoodPath)) return res.json({ songs: [] });
  
  const data = fs.readFileSync(songMoodPath, 'utf8');
  const [header, ...rows] = data.trim().split('\n');
  const keys = header.split(',');
  const songIdx = keys.indexOf('Song Name');
  const artistIdx = keys.indexOf('Artist');
  const moodIdx = keys.indexOf('Final Mood');
  const freqIdx = keys.indexOf('Frequency');
  
  if (songIdx === -1 || artistIdx === -1 || moodIdx === -1) {
    return res.json({ songs: [] });
  }

  // Normalize mood for robust matching
  function normalizeMood(str) {
    return (str || '')
      .toLowerCase()
      .replace(/\s|\+|_|and/gi, '');
  }
  const normQueryMood = normalizeMood(mood);

  // Filter by normalized mood, use frequency for ranking
  const songScores = {};
  rows.forEach(row => {
    const cols = parseCsvRow(row);
    const song = (cols[songIdx] || '').replace(/"/g, '').trim();
    const artist = (cols[artistIdx] || '').replace(/"/g, '').trim();
    const moodName = (cols[moodIdx] || '').replace(/"/g, '').trim();
    const frequency = parseInt(cols[freqIdx] || '1', 10);
    
    const normCsvMood = normalizeMood(moodName);
    console.log(`[top-songs] moodName='${moodName}', normCsvMood='${normCsvMood}', normQueryMood='${normQueryMood}'`);
    // Only match if moods are exactly equivalent
    if (normCsvMood === normQueryMood) {
      const key = `${song} - ${artist}`;
      songScores[key] = (songScores[key] || 0) + frequency;
    }
  });
  
  const topSongs = Object.entries(songScores)
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
  // Accept ?date=YYYY-MM-DD to get week containing that date
  const { date } = req.query;
  
  const moodCsvPath = path.join(__dirname, 'CSVS', 'time+day+mood.csv');
  let rows = [];
  if (fs.existsSync(moodCsvPath)) {
    const data = fs.readFileSync(moodCsvPath, 'utf8');
    const [header, ...rest] = data.trim().split('\n');
    rows = rest;
  }
  
  // Determine the target date (either provided date or today)
  let targetDate;
  if (date) {
    targetDate = new Date(date);
    if (isNaN(targetDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
    }
    console.log('Weekly trends requested for date:', date, 'targetDate:', targetDate);
  } else {
    targetDate = new Date();
    console.log('Weekly trends requested for current date:', targetDate);
  }
  
  // Get start of week (Sunday) for the target date
  const weekStart = new Date(targetDate);
  weekStart.setDate(targetDate.getDate() - targetDate.getDay()); // Sunday
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });
  
  console.log('Week start:', weekStart.toISOString().slice(0, 10));
  console.log('Week days:', weekDays.map(d => d.toISOString().slice(0, 10)));
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

// Alias for /weekly-trends to match frontend expectation
app.get('/weekly-trends', (req, res) => {
  const moodCsvPath = path.join(__dirname, 'CSVS', 'time+day+mood.csv');
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
  const moodCsvPath = path.join(__dirname, 'CSVS', 'time+day+mood.csv');
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
const notesCsvPath = path.join(__dirname, 'CSVS', 'time+note+day+date.csv');
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
    const cols = parseCsvRow(row);
    return {
      date: (cols[dateIdx] || '').trim(),
      time: (cols[timeIdx] || '').trim(),
      note: (cols[noteIdx] || '').trim()
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

// --- Reflections Endpoint ---
const reflectionsCsvPath = path.join(__dirname, 'CSVS', 'time+note+day+date.csv');

// GET /reflections
app.get('/reflections', (req, res) => {
  if (!fs.existsSync(reflectionsCsvPath)) return res.json({ reflections: [] });
  const data = fs.readFileSync(reflectionsCsvPath, 'utf8');
  const [header, ...rows] = data.trim().split('\n');
  const keys = header.split(',');
  const dateIdx = keys.findIndex(k => k.toLowerCase().includes('date'));
  const dayIdx = keys.findIndex(k => k.toLowerCase().includes('day'));
  const timeIdx = keys.findIndex(k => k.toLowerCase().includes('time'));
  const noteIdx = keys.findIndex(k => k.toLowerCase().includes('note'));
  const reflections = rows.map(row => {
    const cols = row.split(',');
    return {
      date: (cols[dateIdx] || '').trim(),
      day: (cols[dayIdx] || '').trim(),
      time: (cols[timeIdx] || '').trim(),
      note: (cols[noteIdx] || '').replace(/"/g, '').trim()
    };
  });
  res.json({ reflections });
});

// POST /reflections - Add reflection to time+note+day+date.csv
app.post('/reflections', (req, res) => {
  const { reflection, date, timeSlot } = req.body;
  if (!reflection || !date || !timeSlot) {
    return res.status(400).json({ error: 'Missing fields: reflection, date, timeSlot' });
  }

  // Convert date from YYYY-MM-DD to DD-MM-YYYY
  let formattedDate = date;
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [yyyy, mm, dd] = date.split('-');
    formattedDate = `${dd}-${mm}-${yyyy}`;
  }

  // Get day of week
  const dateObj = new Date(date);
  const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'long' });

  // Read existing CSV
  let csvData = '';
  if (fs.existsSync(reflectionsCsvPath)) {
    csvData = fs.readFileSync(reflectionsCsvPath, 'utf8');
  } else {
    csvData = 'Date,Day,Time of Day,Short Notes\n';
  }

  const lines = csvData.trim().split('\n');
  const [header, ...rows] = lines;

  // Check if entry already exists for this date and time slot
  let found = false;
  const updatedRows = rows.map(row => {
    const cols = parseCsvRow(row);
    const rowDate = (cols[0] || '').trim();
    const rowTime = (cols[2] || '').trim();
    
    if (rowDate === formattedDate && rowTime.toLowerCase() === timeSlot.toLowerCase()) {
      found = true;
      // Append new reflection with | separator
      const existingNote = (cols[3] || '').trim();
      const newNote = existingNote ? `${existingNote} | ${reflection}` : reflection;
      return `"${formattedDate}","${dayOfWeek}","${timeSlot}","${newNote}"`;
    }
    return row;
  });

  if (!found) {
    // Add new entry
    updatedRows.push(`"${formattedDate}","${dayOfWeek}","${timeSlot}","${reflection}"`);
  }

  // Write back to CSV
  const newCsvData = [header, ...updatedRows].join('\n') + '\n';
  fs.writeFileSync(reflectionsCsvPath, newCsvData, 'utf8');

  console.log(`[reflections] Added reflection for ${formattedDate} ${timeSlot}: ${reflection}`);
  res.json({ success: true, message: 'Reflection saved successfully' });
});

// --- Start Server ---
app.listen(8888, '127.0.0.1', () => {
  console.log('Server running at http://127.0.0.1:8888');
}); 
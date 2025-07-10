# MoodBoard Analysis Pipeline

## Overview
This pipeline automatically analyzes songs playing on Spotify, classifies their mood, and tracks user mood patterns throughout the day.

## Pipeline Flow

### 1. **Current Playback Detection** (`/current-playback-analysis`)
- Uses Spotify Web API to get current playback state
- Triggers analysis after 1 minute of playback
- Prevents duplicate analysis of the same song

### 2. **CSV Structure**

#### **`listening_history.csv`** (Generated from Spotify playback)
```csv
Song Name,Artist,Time of Day,Date
"Shape of You","Ed Sheeran","morning","15-01-2025"
```

#### **`song_chunk_analysis.csv`** (Generated from audio analysis)
```csv
Song Name,Chunk Number,danceability,energy,loudness,speechiness,acousticness,instrumentalness,liveness,valence,tempo
"Shape of You",1,0.825,0.652,-4.2,0.045,0.123,0.001,0.089,0.789,96.0
```

#### **`song_chunk_mood.csv`** (Generated from ML classification)
```csv
Song Name,Chunk Number,Mood
"Shape of You",1,Happy
"Shape of You",2,Energetic
```

#### **`song_mood.csv`** (Generated from mood aggregation)
```csv
Song Name,Artist,Final Mood,Frequency
"Shape of You","Ed Sheeran","Happy and Energetic",1
```

#### **`user_mood.csv`** (Generated from session aggregation)
```csv
Date,Time of Day,Final Mood
"15-01-2025","morning","Happy and Energetic"
```

## API Endpoints

### **GET `/current-playback-analysis`**
Triggers the complete analysis pipeline.

**Response Examples:**

```json
// New song analysis
{
  "status": "analysis_complete",
  "track": {
    "name": "Shape of You",
    "artist": "Ed Sheeran",
    "progress": 65000,
    "duration": 233000
  },
  "mood": "Happy and Energetic",
  "message": "Song analysis completed successfully"
}
```

```json
// Already analyzed song
{
  "status": "already_analyzed",
  "track": {
    "name": "Shape of You",
    "artist": "Ed Sheeran",
    "progress": 65000,
    "duration": 233000
  },
  "message": "Song already analyzed, frequency updated"
}
```

```json
// No playback
{
  "status": "no_playback",
  "message": "No active playback detected"
}
```

## Time Slots
- **Morning**: 6:00 AM - 9:59 AM
- **Afternoon**: 10:00 AM - 1:59 PM  
- **Evening**: 2:00 PM - 5:59 PM
- **Night**: 6:00 PM - 5:59 AM

## Mood Classification
The system uses a 4-mood classification:
- **Sad** → Aggregated as "Sad and Calm"
- **Happy** → Aggregated as "Happy and Energetic"  
- **Energetic** → Combined with valence mood
- **Calm** → Combined with valence mood

## Setup Instructions

### 1. **Start the ML API**
```bash
cd ML
python ml_api.py
```

### 2. **Start the Server**
```bash
node server.js
```

### 3. **Authenticate with Spotify**
- Visit `http://127.0.0.1:8888/login`
- Complete Spotify OAuth flow

### 4. **Test the Pipeline**
```bash
node test_pipeline.js
```

## File Requirements

### **Song Files**
- Place MP3 files in `UserPlaylist/` folder
- Filename format: `{sanitized_song_name}.mp3`
- Example: `shape_of_you.mp3`

### **Environment Variables**
Create `.env` file:
```
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
SPOTIFY_REDIRECT_URI=http://127.0.0.1:8888/callback
```

## CSV Storage Location
All CSVs are stored in the `CSVS/` folder:
- `CSVS/listening_history.csv`
- `CSVS/song_chunk_analysis.csv`
- `CSVS/song_chunk_mood.csv`
- `CSVS/song_mood.csv`
- `CSVS/user_mood.csv`

## Analysis Process

1. **Detection**: Spotify API detects current playback
2. **Trigger**: Analysis triggered after 1 minute of playback
3. **Chunking**: Song split into 30-second chunks
4. **Feature Extraction**: Audio features extracted via Reccobeats API
5. **Mood Classification**: ML model classifies each chunk
6. **Aggregation**: Chunk moods aggregated into song mood
7. **User Mood**: Session moods aggregated into user mood
8. **Storage**: All data stored in appropriate CSVs

## Error Handling
- Duplicate song detection prevents re-analysis
- File not found gracefully handled
- Network errors retried up to 3 times
- Analysis state tracked to prevent conflicts

## Monitoring
Check server logs for:
- `🎵 Analyzing song: {song_name} by {artist}`
- `✅ Chunk {n} analyzed: {mood}`
- `⚠️ Song file not found: {path}`
- `❌ Analysis error: {error}` 
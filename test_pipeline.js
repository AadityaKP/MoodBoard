// Test script for the new pipeline
// Run this to test the current playback analysis endpoint

import axios from 'axios';

async function testPipeline() {
  try {
    console.log('🎵 Testing Current Playback Analysis Pipeline...\n');
    
    // Test the new endpoint
    const response = await axios.get('http://127.0.0.1:8888/current-playback-analysis');
    
    console.log('📊 Response Status:', response.data.status);
    console.log('📝 Message:', response.data.message);
    
    if (response.data.track) {
      console.log('\n🎵 Track Info:');
      console.log('  Name:', response.data.track.name);
      console.log('  Artist:', response.data.track.artist);
      console.log('  Progress:', Math.floor(response.data.track.progress / 1000), 'seconds');
      console.log('  Duration:', Math.floor(response.data.track.duration / 1000), 'seconds');
      
      // Check if song file exists
      const songName = response.data.track.name;
      const sanitizedName = songName
        .normalize('NFKD')
        .replace(/["'""'']/g, '')
        .replace(/[^a-zA-Z0-9 \-_]/g, '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_');
      
      console.log('\n📁 Expected file name:', `${sanitizedName}.mp3`);
      console.log('📁 Expected location: MoodBoard/UserPlaylist/');
    }
    
    if (response.data.mood) {
      console.log('\n😊 Song Mood:', response.data.mood);
    }
    
    if (response.data.currentTrack) {
      console.log('\n📋 Current Track State:');
      console.log('  ID:', response.data.currentTrack.id);
      console.log('  Analyzed:', response.data.currentTrack.analyzed);
      if (response.data.currentTrack.mood) {
        console.log('  Mood:', response.data.currentTrack.mood);
      }
    }
    
    console.log('\n🔍 Troubleshooting:');
    console.log('1. Make sure you\'re playing music on Spotify');
    console.log('2. Wait at least 1 minute after starting a song');
    console.log('3. Ensure the MP3 file exists in MoodBoard/UserPlaylist/');
    console.log('4. Check that you\'re authenticated with Spotify');
    console.log('5. Run this test again after 1 minute of playback');
    
    console.log('\n✅ Pipeline test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      console.log('\n🔐 Authentication Error:');
      console.log('Visit http://127.0.0.1:8888/login to authenticate with Spotify');
    }
  }
}

// Run the test
testPipeline(); 
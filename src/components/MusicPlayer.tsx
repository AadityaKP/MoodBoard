import { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SkipBack, SkipForward, Music, RefreshCw } from "lucide-react";

interface SpotifyUser {
  id: string;
  display_name: string;
  images: Array<{ url: string }>;
}

interface MusicPlayerProps {
  onAnalysis?: () => void;
  setUser?: (user: SpotifyUser | null) => void;
}

const SERVER_URL = 'http://127.0.0.1:8888';

export default function MusicPlayer({ onAnalysis, setUser }: MusicPlayerProps) {
  const [accessToken, setAccessToken] = useState(null);
  const [currentTrack, setCurrentTrack] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  // For analysis trigger
  const lastAnalyzedTrack = useRef<string | null>(null);
  const lastAnalyzedMinute = useRef<number>(-1);

  // Listen for access token from popup
  useEffect(() => {
    const handler = (event: any) => {
      if (event.data && event.data.type === 'SPOTIFY_TOKEN') {
        setAccessToken(event.data.token);
        // Fetch user profile after login
        if (setUser) {
          fetchUserProfile(event.data.token);
        }
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [setUser]);

  // Fetch Spotify user profile
  const fetchUserProfile = async (token: string) => {
    try {
      const response = await fetch('https://api.spotify.com/v1/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const userData = await response.json();
        setUser?.(userData);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  // Fetch current track (now also returns progress)
  const getCurrentTrack = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${SERVER_URL}/current-playback-analysis`);
      const data = await res.json();
      if (data.track) {
        setCurrentTrack(data.track);
      } else {
        setCurrentTrack(null);
      }
      // If a song was analyzed or frequency updated, trigger dashboard refresh
      if (onAnalysis && (data.status === 'analysis_complete' || data.status === 'already_analyzed')) {
        onAnalysis();
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Control playback
  const control = async (action: string) => {
    await fetch(`${SERVER_URL}/control`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    setTimeout(getCurrentTrack, 1000);
  };

  // No need for triggerAnalysisIfNeeded, handled by getCurrentTrack

  // Poll for updates and trigger analysis if needed
  useEffect(() => {
    if (accessToken) {
      const poll = async () => {
        await getCurrentTrack();
      };
      poll(); // initial call
      const interval = setInterval(poll, 30000); // every 30 seconds
      return () => clearInterval(interval);
    }
  }, [accessToken]);

  // Login handler (popup)
  const login = () => {
    const width = 500, height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    window.open(
      `${SERVER_URL}/login`,
      'Spotify Login',
      `width=${width},height=${height},left=${left},top=${top}`
    );
  };

  return (
    <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-xl h-[391px]">
      <div className="p-4">
        <h2 className="text-xl font-semibold text-purple-600 mb-3 text-center">
          Music Player
        </h2>
        <div className="space-y-4 h-[311px] flex flex-col">
        {!accessToken ? (
          <div className="text-center space-y-4">
            <p className="text-sm text-gray-600">Connect your Spotify account to control playback</p>
            <Button onClick={login} className="w-full bg-green-600 hover:bg-green-700">
              Login with Spotify
            </Button>
            <p className="text-xs text-gray-500">
              This will open Spotify login and return here.
            </p>
          </div>
        ) : (
          <>
            <div className="text-center flex-1 flex flex-col justify-center">
              {isLoading ? (
                <div className="flex items-center justify-center space-x-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Loading...</span>
                </div>
              ) : currentTrack ? (
                <div className="space-y-2">
                  {currentTrack.image && (
                    <img
                      src={currentTrack.image}
                      alt="Album Art"
                      className="w-32 h-32 rounded-lg mx-auto"
                    />
                  )}
                  <h3 className="font-medium text-lg">{currentTrack.name}</h3>
                  <p className="text-md text-gray-600">{currentTrack.artist}</p>
                </div>
              ) : (
                <>
                  <div className="w-32 h-32 bg-gray-200 rounded-lg mx-auto mb-4 flex items-center justify-center">
                    <Music className="w-16 h-16 text-gray-400" />
                  </div>
                  <h3 className="font-medium text-lg text-gray-700">No track playing</h3>
                  <p className="text-sm text-gray-500">Start playing music on Spotify</p>
                </>
              )}
            </div>
            <div className="flex items-center justify-center space-x-4 mt-auto">
              <Button variant="ghost" size="sm" onClick={() => control("previous")} disabled={!currentTrack}>
                <SkipBack className="w-6 h-6" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => control("next")} disabled={!currentTrack}>
                <SkipForward className="w-6 h-6" />
              </Button>
            </div>
          </>
        )}
        </div>
      </div>
    </Card>
  );
}

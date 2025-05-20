import { Audio, AVPlaybackStatus } from 'expo-av';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { DownloadedSong } from '../services/api';

interface AudioPlayerContextType {
  currentSong: DownloadedSong | null;
  isPlaying: boolean;
  duration: number;
  position: number;
  playbackInstance: Audio.Sound | null;
  playSong: (song: DownloadedSong) => Promise<void>;
  pauseSong: () => Promise<void>;
  resumeSong: () => Promise<void>;
  seekTo: (position: number) => Promise<void>;
  playNextSong: () => Promise<void>;
  playPreviousSong: () => Promise<void>;
  playlist: DownloadedSong[];
  setPlaylist: (songs: DownloadedSong[]) => void;
  stopSong: () => Promise<void>;
  stopSongAndClear: () => Promise<void>;
}

const AudioPlayerContext = createContext<AudioPlayerContextType | undefined>(undefined);

export const AudioPlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentSong, setCurrentSong] = useState<DownloadedSong | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackInstance, setPlaybackInstance] = useState<Audio.Sound | null>(null);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [playlist, setPlaylist] = useState<DownloadedSong[]>([]);
  const [masterPlaylist, setMasterPlaylist] = useState<DownloadedSong[]>([]);

  // Initialize audio
  useEffect(() => {
    const initAudio = async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          // Remove the problematic Android interruption mode
          shouldDuckAndroid: false,
          interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
        });
      } catch (error) {
        console.error('Error initializing audio:', error);
      }
    };

    initAudio();

    // Cleanup
    return () => {
      if (playbackInstance) {
        playbackInstance.unloadAsync();
      }
    };
  }, []);

  // Update position every second
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isPlaying) {
      interval = setInterval(async () => {
        if (playbackInstance) {
          const status = await playbackInstance.getStatusAsync();
          if (status.isLoaded) {
            setPosition(status.positionMillis);
          }
        }
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [isPlaying, playbackInstance]);

  const updatePlaybackStatus = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;
    
    setIsPlaying(status.isPlaying);
    setDuration(status.durationMillis || 0);
    setPosition(status.positionMillis);

    // Auto-play next song when current one ends
    if (status.didJustFinish) {
      playNextSong();
    }
  };

  // Listen for playback status changes to ensure auto-play works
  useEffect(() => {
    if (playbackInstance) {
      playbackInstance.setOnPlaybackStatusUpdate(updatePlaybackStatus);
      return () => {
        playbackInstance.setOnPlaybackStatusUpdate(null);
      };
    }
  }, [playbackInstance]);

  // Update masterPlaylist whenever playlist changes
  useEffect(() => {
    if (playlist.length > 0) {
      setMasterPlaylist(playlist);
    }
  }, [playlist]);

  const playSong = async (song: DownloadedSong) => {
    try {
      // Unload previous song if exists
      if (playbackInstance) {
        await playbackInstance.unloadAsync();
      }

      // If the playlist is empty but we have a masterPlaylist, restore it
      if (playlist.length === 0 && masterPlaylist.length > 0) {
        setPlaylist(masterPlaylist);
      }

      // Load and play new song
      const { sound } = await Audio.Sound.createAsync(
        { uri: song.filePath },
        { shouldPlay: true },
        updatePlaybackStatus
      );

      setPlaybackInstance(sound);
      setCurrentSong(song);
      setIsPlaying(true);
    } catch (error) {
      console.error('Error playing song:', error);
    }
  };

  const pauseSong = async () => {
    try {
      if (playbackInstance) {
        await playbackInstance.pauseAsync();
      }
    } catch (error) {
      console.error('Error pausing song:', error);
    }
  };

  const resumeSong = async () => {
    try {
      if (playbackInstance) {
        await playbackInstance.playAsync();
      }
    } catch (error) {
      console.error('Error resuming song:', error);
    }
  };

  const seekTo = async (position: number) => {
    if (playbackInstance) {
      await playbackInstance.setPositionAsync(position);
    }
  };

  const getCurrentSongIndex = () => {
    if (!currentSong) return -1;
    
    // First check in current playlist
    if (playlist.length > 0) {
      const index = playlist.findIndex(song => song.id === currentSong.id);
      if (index !== -1) return index;
    }
    
    // If not found or playlist is empty, check in masterPlaylist
    if (masterPlaylist.length > 0) {
      return masterPlaylist.findIndex(song => song.id === currentSong.id);
    }
    
    return -1;
  };

  const getEffectivePlaylist = () => {
    // Use the current playlist if it has songs, otherwise fall back to the master playlist
    return playlist.length > 0 ? playlist : masterPlaylist;
  };

  const playNextSong = async () => {
    const effectivePlaylist = getEffectivePlaylist();
    if (effectivePlaylist.length === 0) return;
    
    const currentIndex = getCurrentSongIndex();
    if (currentIndex === -1) return;
    
    const nextIndex = (currentIndex + 1) % effectivePlaylist.length;
    await playSong(effectivePlaylist[nextIndex]);
  };

  const playPreviousSong = async () => {
    const effectivePlaylist = getEffectivePlaylist();
    if (effectivePlaylist.length === 0) return;
    
    const currentIndex = getCurrentSongIndex();
    if (currentIndex === -1) return;
    
    const previousIndex = (currentIndex - 1 + effectivePlaylist.length) % effectivePlaylist.length;
    await playSong(effectivePlaylist[previousIndex]);
  };

  const stopSong = async () => {
    if (playbackInstance) {
      await playbackInstance.stopAsync();
      await playbackInstance.unloadAsync();
      setPlaybackInstance(null);
    }
    setCurrentSong(null);
    setIsPlaying(false);
    setPosition(0);
    setDuration(0);
  };

  const stopSongAndClear = async () => {
    await stopSong();
  };

  const setPlaylistWithMaster = (songs: DownloadedSong[]) => {
    setPlaylist(songs);
    if (songs.length > 0) {
      setMasterPlaylist(songs);
    }
  };

  return (
    <AudioPlayerContext.Provider
      value={{
        currentSong,
        isPlaying,
        duration,
        position,
        playbackInstance,
        playSong,
        pauseSong,
        resumeSong,
        seekTo,
        playNextSong,
        playPreviousSong,
        playlist,
        setPlaylist: setPlaylistWithMaster,
        stopSong,
        stopSongAndClear,
      }}
    >
      {children}
    </AudioPlayerContext.Provider>
  );
};

export const useAudioPlayer = () => {
  const context = useContext(AudioPlayerContext);
  if (context === undefined) {
    throw new Error('useAudioPlayer must be used within an AudioPlayerProvider');
  }
  return context;
};
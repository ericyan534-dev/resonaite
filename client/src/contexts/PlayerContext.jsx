import React, { createContext, useContext, useState, useRef, useEffect } from "react";
import * as api from "../services/api";

const PlayerContext = createContext();

export const PlayerProvider = ({ children }) => {
  const [currentTrack, setCurrentTrack] = useState(null);
  const [queue, setQueue] = useState([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolumeState] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [repeat, setRepeat] = useState(0); // 0: off, 1: all, 2: one
  const [shuffle, setShuffle] = useState(false);

  const audioRef = useRef(new Audio());

  // Update currentTime on timeupdate
  useEffect(() => {
    const audio = audioRef.current;
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleEnded = () => {
      if (repeat === 2) {
        audio.currentTime = 0;
        audio.play();
      } else {
        skipNext();
      }
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [repeat, queue, queueIndex]);

  const playTrack = async (track) => {
    try {
      const audio = audioRef.current;
      const streamUrl = api.getTrackStreamUrl(track.id);

      audio.src = streamUrl;
      setCurrentTrack(track);
      setQueue([track]);
      setQueueIndex(0);
      setCurrentTime(0);

      // Load metadata
      audio.load();

      // Play after a brief delay to ensure src is set
      setTimeout(() => {
        audio.play().catch(err => console.error("Playback failed:", err));
      }, 100);

      setPlaying(true);
    } catch (error) {
      console.error("Failed to play track:", error);
    }
  };

  const pause = () => {
    audioRef.current.pause();
    setPlaying(false);
  };

  const resume = () => {
    audioRef.current.play().catch(err => console.error("Playback failed:", err));
    setPlaying(true);
  };

  const togglePlay = () => {
    if (playing) {
      pause();
    } else if (currentTrack) {
      resume();
    }
  };

  const skipNext = () => {
    if (queue.length === 0) return;

    let nextIndex = queueIndex + 1;
    if (nextIndex >= queue.length) {
      if (repeat === 1) {
        nextIndex = 0;
      } else {
        setCurrentTrack(null);
        setPlaying(false);
        return;
      }
    }

    setQueueIndex(nextIndex);
    const nextTrack = queue[nextIndex];
    const audio = audioRef.current;
    const streamUrl = api.getTrackStreamUrl(nextTrack.id);

    audio.src = streamUrl;
    setCurrentTrack(nextTrack);
    setCurrentTime(0);
    audio.load();
    setTimeout(() => {
      audio.play().catch(err => console.error("Playback failed:", err));
    }, 100);
    setPlaying(true);
  };

  const skipPrev = () => {
    if (queue.length === 0) return;

    const audio = audioRef.current;
    if (audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }

    let prevIndex = queueIndex - 1;
    if (prevIndex < 0) {
      prevIndex = queue.length - 1;
    }

    setQueueIndex(prevIndex);
    const prevTrack = queue[prevIndex];
    const streamUrl = api.getTrackStreamUrl(prevTrack.id);

    audio.src = streamUrl;
    setCurrentTrack(prevTrack);
    setCurrentTime(0);
    audio.load();
    setTimeout(() => {
      audio.play().catch(err => console.error("Playback failed:", err));
    }, 100);
    setPlaying(true);
  };

  const seek = (time) => {
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  };

  const setVolume = (vol) => {
    const clampedVol = Math.max(0, Math.min(1, vol));
    audioRef.current.volume = clampedVol;
    setVolumeState(clampedVol);
  };

  const addToQueue = (track) => {
    setQueue([...queue, track]);
  };

  const clearQueue = () => {
    setQueue([]);
    setCurrentTrack(null);
    setPlaying(false);
    audioRef.current.pause();
  };

  return (
    <PlayerContext.Provider
      value={{
        currentTrack,
        queue,
        playing,
        volume,
        currentTime,
        duration,
        repeat,
        shuffle,
        playTrack,
        pause,
        resume,
        togglePlay,
        skipNext,
        skipPrev,
        seek,
        setVolume,
        addToQueue,
        clearQueue,
        setRepeat,
        setShuffle,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
};

export const usePlayer = () => {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error("usePlayer must be used within PlayerProvider");
  }
  return context;
};

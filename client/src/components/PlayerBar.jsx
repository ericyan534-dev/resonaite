import { usePlayer } from "../contexts/PlayerContext";
import { useTheme } from "../contexts/ThemeContext";
import WaveViz from "./WaveViz";
import Glass from "./Glass";
import { Play, Pause, SkipBack, SkipForward, Volume2 } from "lucide-react";

const PlayerBar = () => {
  const { theme } = useTheme();
  const {
    currentTrack,
    playing,
    togglePlay,
    skipNext,
    skipPrev,
    volume,
    setVolume,
    currentTime,
    duration,
    seek,
  } = usePlayer();

  if (!currentTrack) {
    return (
      <Glass
        theme={theme}
        style={{
          position: "fixed",
          bottom: 20,
          left: 20,
          right: 20,
          height: 80,
          zIndex: 50,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: theme.colors.textMuted,
        }}
      >
        No track selected
      </Glass>
    );
  }

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <Glass
      theme={theme}
      style={{
        position: "fixed",
        bottom: 20,
        left: 20,
        right: 20,
        zIndex: 50,
        padding: "12px 20px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "16px",
          marginBottom: "12px",
        }}
      >
        {/* Track Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: theme.colors.text, fontSize: "14px", fontWeight: 500 }}>
            {currentTrack.title}
          </div>
          <div style={{ color: theme.colors.textMuted, fontSize: "12px" }}>
            {currentTrack.mood} • {currentTrack.bpm} BPM
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <button
            onClick={skipPrev}
            style={{
              background: "none",
              color: theme.colors.accent,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
            }}
          >
            <SkipBack size={20} />
          </button>

          <button
            onClick={togglePlay}
            style={{
              background: theme.colors.accent,
              color: theme.colors.bg1,
              border: "none",
              borderRadius: "50%",
              width: 40,
              height: 40,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            {playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
          </button>

          <button
            onClick={skipNext}
            style={{
              background: "none",
              color: theme.colors.accent,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
            }}
          >
            <SkipForward size={20} />
          </button>

          {/* Volume */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginLeft: "8px" }}>
            <Volume2 size={16} color={theme.colors.accent} />
            <input
              type="range"
              min="0"
              max="100"
              value={volume * 100}
              onChange={(e) => setVolume(e.target.valueAsNumber / 100)}
              style={{
                width: "60px",
                cursor: "pointer",
              }}
            />
          </div>
        </div>
      </div>

      {/* Wave Viz */}
      <div style={{ marginBottom: "12px" }}>
        <WaveViz theme={theme} playing={playing} h={24} w={240} />
      </div>

      {/* Progress Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          color: theme.colors.textMuted,
          fontSize: "11px",
        }}
      >
        <span>{Math.floor(currentTime / 60)}:{String(Math.floor(currentTime % 60)).padStart(2, "0")}</span>
        <div
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const percent = (e.clientX - rect.left) / rect.width;
            seek(percent * duration);
          }}
          style={{
            flex: 1,
            height: "3px",
            background: theme.colors.glassBorder,
            borderRadius: "2px",
            position: "relative",
            cursor: "pointer",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${progressPercent}%`,
              background: theme.colors.accent,
              borderRadius: "2px",
            }}
          />
        </div>
        <span>{Math.floor(duration / 60)}:{String(Math.floor(duration % 60)).padStart(2, "0")}</span>
      </div>
    </Glass>
  );
};

export default PlayerBar;

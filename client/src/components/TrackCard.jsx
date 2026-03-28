import { useTheme } from "../contexts/ThemeContext";
import Glass from "./Glass";
import { Play, Music } from "lucide-react";

const TrackCard = ({ track, size = "medium", onClick }) => {
  const { theme } = useTheme();

  const sizes = {
    small: { width: 140, height: 140, padding: 12, titleSize: 12, gap: 8 },
    medium: { width: 180, height: 200, padding: 16, titleSize: 14, gap: 12 },
    large: { width: 240, height: 280, padding: 20, titleSize: 16, gap: 16 },
  };

  const config = sizes[size] || sizes.medium;

  return (
    <Glass
      theme={theme}
      onClick={onClick}
      style={{
        width: config.width,
        cursor: "pointer",
        transition: "all 0.2s",
        flexShrink: 0,
        position: "relative",
        overflow: "hidden",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = theme.colors.glassHover;
        e.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = theme.colors.glass;
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      {/* Cover Art */}
      <div
        style={{
          width: "100%",
          height: config.width,
          background: `linear-gradient(${theme.gradientAngle}deg, ${theme.colors.accentSoft}, ${theme.colors.bg3})`,
          borderRadius: theme.cardRadius,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          marginBottom: config.gap,
        }}
      >
        <Music size={config.width / 3} color={theme.colors.accent} opacity="0.5" />

        {/* Play Button Overlay */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClick?.();
          }}
          style={{
            position: "absolute",
            bottom: 12,
            right: 12,
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
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            e.target.style.transform = "scale(1.1)";
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = "scale(1)";
          }}
        >
          <Play size={20} fill="currentColor" />
        </button>
      </div>

      {/* Info */}
      <div style={{ gap: config.gap, display: "flex", flexDirection: "column" }}>
        <div>
          <div
            style={{
              color: theme.colors.text,
              fontSize: config.titleSize,
              fontWeight: 600,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {track.title}
          </div>
          {track.artist && (
            <div
              style={{
                color: theme.colors.textMuted,
                fontSize: config.titleSize - 2,
                marginTop: "4px",
              }}
            >
              {track.artist}
            </div>
          )}
        </div>

        {/* Meta */}
        <div
          style={{
            display: "flex",
            gap: "8px",
            fontSize: "11px",
            color: theme.colors.textMuted,
            flexWrap: "wrap",
          }}
        >
          {track.mood && <span>{track.mood}</span>}
          {track.bpm && <span>{track.bpm} BPM</span>}
          {track.duration && (
            <span>{Math.floor(track.duration / 60)}:{String(Math.floor(track.duration % 60)).padStart(2, "0")}</span>
          )}
        </div>
      </div>
    </Glass>
  );
};

export default TrackCard;

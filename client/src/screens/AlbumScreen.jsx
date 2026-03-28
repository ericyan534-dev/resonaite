import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTheme } from "../contexts/ThemeContext";
import { usePlayer } from "../contexts/PlayerContext";
import Glass from "../components/Glass";
import * as api from "../services/api";
import { ArrowLeft, Heart, Music } from "lucide-react";

const AlbumScreen = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { playTrack } = usePlayer();

  const [album, setAlbum] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAlbum = async () => {
      try {
        const data = await api.getAlbum(id);
        setAlbum(data);
      } catch (error) {
        console.error("Failed to load album:", error);
      } finally {
        setLoading(false);
      }
    };

    loadAlbum();
  }, [id]);

  const handleAddToLibrary = async (track) => {
    try {
      await api.addToLibrary(track.id);
      alert("Track added to library!");
    } catch (error) {
      console.error("Failed to add to library:", error);
    }
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${String(secs).padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: theme?.colors?.textMuted,
          zIndex: 10,
          position: "relative",
        }}
      >
        Loading...
      </div>
    );
  }

  if (!album) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: theme?.colors?.textMuted,
          zIndex: 10,
          position: "relative",
        }}
      >
        Album not found
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        overflow: "auto",
        padding: "20px",
        paddingBottom: "120px",
        zIndex: 10,
        position: "relative",
      }}
    >
      {/* Back Button */}
      <button
        onClick={() => navigate(-1)}
        style={{
          background: "none",
          border: "none",
          color: theme.colors.accent,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: "4px",
          fontSize: "13px",
          fontWeight: 500,
          marginBottom: "16px",
        }}
      >
        <ArrowLeft size={16} />
        Back
      </button>

      {/* Album Header */}
      <div
        style={{
          background: `linear-gradient(${theme.gradientAngle}deg, ${theme.colors.accentSoft}, ${theme.colors.bg3})`,
          borderRadius: theme.cardRadius,
          padding: "32px",
          textAlign: "center",
          marginBottom: "32px",
        }}
      >
        <h1
          style={{
            fontSize: "28px",
            fontWeight: 600,
            color: theme.colors.text,
            marginBottom: "8px",
          }}
        >
          {album.title}
        </h1>
        {album.description && (
          <p
            style={{
              fontSize: "13px",
              color: theme.colors.textMuted,
              marginTop: "8px",
            }}
          >
            {album.description}
          </p>
        )}
        <div
          style={{
            fontSize: "12px",
            color: theme.colors.textMuted,
            marginTop: "12px",
          }}
        >
          {album.trackCount} tracks
        </div>
      </div>

      {/* Tracks List */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {album.tracks && album.tracks.length > 0 ? (
          album.tracks.map((track, index) => (
            <Glass
              key={track.id}
              theme={theme}
              style={{
                padding: "12px",
                display: "flex",
                alignItems: "center",
                gap: "12px",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
              onClick={() => playTrack(track)}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = theme.colors.glassHover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = theme.colors.glass;
              }}
            >
              {/* Track Number */}
              <div
                style={{
                  width: "24px",
                  flexShrink: 0,
                  textAlign: "center",
                  fontSize: "12px",
                  color: theme.colors.textMuted,
                  fontWeight: 500,
                }}
              >
                {index + 1}
              </div>

              {/* Cover Thumbnail */}
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  background: `linear-gradient(${theme.gradientAngle}deg, ${theme.colors.accentSoft}, ${theme.colors.bg3})`,
                  borderRadius: theme.cardRadius,
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Music size={16} color={theme.colors.accent} opacity="0.5" />
              </div>

              {/* Track Info */}
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: theme.colors.text,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {track.title}
                </div>
                <div
                  style={{
                    fontSize: "11px",
                    color: theme.colors.textMuted,
                    display: "flex",
                    gap: "8px",
                    marginTop: "2px",
                  }}
                >
                  {track.mood && <span>{track.mood}</span>}
                  {track.bpm && <span>{track.bpm} BPM</span>}
                  {track.duration && <span>{formatDuration(track.duration)}</span>}
                </div>
              </div>

              {/* Actions */}
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  alignItems: "center",
                }}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAddToLibrary(track);
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: theme.colors.textMuted,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    padding: "4px",
                    transition: "all 0.2s",
                    fontSize: "11px",
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.color = theme.colors.accent;
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.color = theme.colors.textMuted;
                  }}
                >
                  <Heart size={16} />
                </button>
              </div>
            </Glass>
          ))
        ) : (
          <div style={{ color: theme.colors.textMuted, textAlign: "center", padding: "40px" }}>
            No tracks in this album
          </div>
        )}
      </div>
    </div>
  );
};

export default AlbumScreen;

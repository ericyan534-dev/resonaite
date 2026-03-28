import { useState, useEffect } from "react";
import { useTheme } from "../contexts/ThemeContext";
import { usePlayer } from "../contexts/PlayerContext";
import Glass from "../components/Glass";
import * as api from "../services/api";
import { Heart, Music } from "lucide-react";

const LibraryScreen = () => {
  const { theme } = useTheme();
  const { playTrack } = usePlayer();

  const [tab, setTab] = useState("all"); // all, liked, generated, albums
  const [tracks, setTracks] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadLibrary = async () => {
      try {
        const libraryData = await api.getLibrary();
        if (libraryData?.tracks) {
          setTracks(libraryData.tracks);
        }

        const albumsData = await api.getAlbums();
        if (albumsData?.data) {
          setAlbums(albumsData.data);
        }
      } catch (error) {
        console.error("Failed to load library:", error);
      } finally {
        setLoading(false);
      }
    };

    loadLibrary();
  }, []);

  const handleToggleLike = async (track) => {
    try {
      if (track.liked) {
        await api.updateLibraryTrack(track.id, { liked: false });
      } else {
        await api.updateLibraryTrack(track.id, { liked: true });
      }

      setTracks(
        tracks.map((t) =>
          t.id === track.id ? { ...t, liked: !t.liked } : t
        )
      );
    } catch (error) {
      console.error("Failed to update like status:", error);
    }
  };

  let displayTracks = tracks;

  if (tab === "liked") {
    displayTracks = tracks.filter((t) => t.liked);
  } else if (tab === "generated") {
    displayTracks = tracks.filter((t) => t.isGenerated);
  }

  if (searchQuery.trim()) {
    displayTracks = displayTracks.filter(
      (t) =>
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.artist && t.artist.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${String(secs).padStart(2, "0")}`;
  };

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
      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <h1
          style={{
            fontSize: "28px",
            fontWeight: 600,
            color: theme.colors.text,
            marginBottom: "16px",
          }}
        >
          Your Library
        </h1>

        {/* Search */}
        <input
          type="text"
          placeholder="Search tracks..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: "100%",
            background: theme.colors.cardBg,
            border: `1px solid ${theme.colors.glassBorder}`,
            borderRadius: theme.cardRadius,
            padding: "10px 12px",
            color: theme.colors.text,
            fontSize: "13px",
            fontFamily: "Georgia, serif",
          }}
        />
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          marginBottom: "24px",
          flexWrap: "wrap",
        }}
      >
        {["all", "liked", "generated", "albums"].map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              setSearchQuery("");
            }}
            style={{
              background: tab === t ? theme.colors.accent : theme.colors.glass,
              color: tab === t ? theme.colors.bg1 : theme.colors.text,
              border: `1px solid ${
                tab === t ? theme.colors.accent : theme.colors.glassBorder
              }`,
              borderRadius: theme.cardRadius,
              padding: "8px 16px",
              fontSize: "12px",
              fontWeight: 500,
              cursor: "pointer",
              transition: "all 0.2s",
              textTransform: "capitalize",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ color: theme.colors.textMuted, textAlign: "center", padding: "40px" }}>
          Loading...
        </div>
      ) : (
        <>
          {tab === "albums" ? (
            // Albums View
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                gap: "16px",
              }}
            >
              {albums.length === 0 ? (
                <div style={{ gridColumn: "1 / -1", color: theme.colors.textMuted }}>
                  No albums yet
                </div>
              ) : (
                albums.map((album) => (
                  <Glass
                    key={album.id}
                    theme={theme}
                    onClick={() => console.log("Album:", album)}
                    style={{
                      padding: "0",
                      cursor: "pointer",
                      overflow: "hidden",
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-2px)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                    }}
                  >
                    <div
                      style={{
                        width: "100%",
                        aspectRatio: "1",
                        background: `linear-gradient(${theme.gradientAngle}deg, ${theme.colors.accentSoft}, ${theme.colors.bg3})`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    />
                    <div style={{ padding: "12px" }}>
                      <div
                        style={{
                          fontSize: "12px",
                          fontWeight: 600,
                          color: theme.colors.text,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {album.title}
                      </div>
                      <div
                        style={{
                          fontSize: "10px",
                          color: theme.colors.textMuted,
                        }}
                      >
                        {album.trackCount} tracks
                      </div>
                    </div>
                  </Glass>
                ))
              )}
            </div>
          ) : (
            // Tracks View
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {displayTracks.length === 0 ? (
                <div style={{ color: theme.colors.textMuted, padding: "40px 20px", textAlign: "center" }}>
                  {searchQuery ? "No tracks found" : `No ${tab} tracks yet`}
                </div>
              ) : (
                displayTracks.map((track) => (
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

                    {/* Like Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleLike(track);
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        color: track.liked ? theme.colors.accent : theme.colors.textMuted,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        padding: "4px",
                        transition: "all 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.color = theme.colors.accent;
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.color = track.liked ? theme.colors.accent : theme.colors.textMuted;
                      }}
                    >
                      <Heart size={18} fill={track.liked ? "currentColor" : "none"} />
                    </button>
                  </Glass>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default LibraryScreen;

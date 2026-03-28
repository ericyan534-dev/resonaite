import { useState, useEffect } from "react";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../contexts/AuthContext";
import { usePlayer } from "../contexts/PlayerContext";
import Glass from "../components/Glass";
import TrackCard from "../components/TrackCard";
import * as api from "../services/api";
import { CIM_PRESETS } from "../constants/themes";

const HomeScreen = () => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { playTrack } = usePlayer();

  const [featuredTrack, setFeaturedTrack] = useState(null);
  const [continueListening, setContinueListening] = useState([]);
  const [madeForYou, setMadeForYou] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [tracksData, albumsData, libraryData] = await Promise.all([
          api.getTracks({ limit: 20 }),
          api.getAlbums(),
          api.getLibrary(),
        ]);

        // Featured track: first from all tracks
        if (tracksData?.data && tracksData.data.length > 0) {
          setFeaturedTrack(tracksData.data[0]);
          setMadeForYou(tracksData.data.slice(1, 7));
        }

        // Continue listening: from library sorted by last_played
        if (libraryData?.tracks) {
          const sorted = [...libraryData.tracks].sort(
            (a, b) => new Date(b.last_played) - new Date(a.last_played)
          );
          setContinueListening(sorted.slice(0, 6));
        }

        // Albums
        if (albumsData?.data) {
          setAlbums(albumsData.data.slice(0, 6));
        }
      } catch (error) {
        console.error("Failed to load home data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    let timeGreeting;
    if (hour < 5) timeGreeting = "Still up? Let's wind down";
    else if (hour < 12) timeGreeting = "Good morning";
    else if (hour < 18) timeGreeting = "Good afternoon";
    else if (hour < 21) timeGreeting = "Good evening";
    else timeGreeting = "Good night";

    return `${timeGreeting}, ${user?.displayName || "friend"}.`;
  };

  const SectionTitle = ({ children }) => (
    <h2
      style={{
        fontSize: "16px",
        fontWeight: 600,
        color: theme.colors.text,
        marginBottom: "16px",
        marginLeft: "20px",
      }}
    >
      {children}
    </h2>
  );

  const ScrollRow = ({ children }) => (
    <div
      style={{
        display: "flex",
        gap: "16px",
        overflowX: "auto",
        paddingBottom: "8px",
        marginBottom: "32px",
        scrollBehavior: "smooth",
        paddingLeft: "20px",
        paddingRight: "20px",
      }}
    >
      {children}
    </div>
  );

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        overflow: "auto",
        padding: "20px 0",
        paddingBottom: "120px",
        zIndex: 10,
        position: "relative",
      }}
    >
      {/* Greeting */}
      <div
        style={{
          padding: "20px",
          marginBottom: "24px",
        }}
      >
        <h1
          style={{
            fontSize: "28px",
            fontWeight: 600,
            color: theme.colors.text,
            marginBottom: "4px",
          }}
        >
          {getGreeting()}
        </h1>
        <p
          style={{
            fontSize: "13px",
            color: theme.colors.textMuted,
          }}
        >
          {theme.greeting}
        </p>
      </div>

      {loading ? (
        <div
          style={{
            textAlign: "center",
            color: theme.colors.textMuted,
            padding: "40px 20px",
          }}
        >
          Loading...
        </div>
      ) : (
        <>
          {/* Featured Track */}
          {featuredTrack && (
            <div style={{ marginBottom: "32px", paddingLeft: "20px" }}>
              <SectionTitle>Featured Today</SectionTitle>
              <div
                style={{
                  maxWidth: "420px",
                  width: "100%",
                }}
              >
                <TrackCard
                  track={featuredTrack}
                  size="large"
                  onClick={() => playTrack(featuredTrack)}
                />
              </div>
            </div>
          )}

          {/* Continue Listening */}
          {continueListening.length > 0 && (
            <div>
              <SectionTitle>Continue Listening</SectionTitle>
              <ScrollRow>
                {continueListening.map((track) => (
                  <TrackCard
                    key={track.id}
                    track={track}
                    size="medium"
                    onClick={() => playTrack(track)}
                  />
                ))}
              </ScrollRow>
            </div>
          )}

          {/* Made For You */}
          {madeForYou.length > 0 && (
            <div>
              <SectionTitle>Made For You</SectionTitle>
              <ScrollRow>
                {madeForYou.map((track) => (
                  <TrackCard
                    key={track.id}
                    track={track}
                    size="medium"
                    onClick={() => playTrack(track)}
                  />
                ))}
              </ScrollRow>
            </div>
          )}

          {/* Quick Sessions (CIM Presets) */}
          <div>
            <SectionTitle>Quick Sessions</SectionTitle>
            <ScrollRow>
              {CIM_PRESETS.map((preset) => (
                <Glass
                  key={preset.id}
                  theme={theme}
                  onClick={() => console.log("CIM preset:", preset)}
                  style={{
                    width: 160,
                    padding: "16px",
                    cursor: "pointer",
                    flexShrink: 0,
                    transition: "all 0.2s",
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
                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: 600,
                      color: theme.colors.text,
                      marginBottom: "6px",
                    }}
                  >
                    {preset.name}
                  </div>
                  <div
                    style={{
                      fontSize: "11px",
                      color: theme.colors.textMuted,
                      marginBottom: "8px",
                    }}
                  >
                    {preset.description}
                  </div>
                  <div
                    style={{
                      fontSize: "10px",
                      color: theme.colors.accent,
                      fontWeight: 500,
                    }}
                  >
                    {preset.hz} Hz • {preset.band}
                  </div>
                </Glass>
              ))}
            </ScrollRow>
          </div>

          {/* Explore Albums */}
          {albums.length > 0 && (
            <div>
              <SectionTitle>Explore Albums</SectionTitle>
              <ScrollRow>
                {albums.map((album) => (
                  <Glass
                    key={album.id}
                    theme={theme}
                    onClick={() => console.log("Album:", album)}
                    style={{
                      width: 160,
                      padding: "0",
                      cursor: "pointer",
                      flexShrink: 0,
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
                        height: "160px",
                        background: `linear-gradient(${theme.gradientAngle}deg, ${theme.colors.accentSoft}, ${theme.colors.bg3})`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    />
                    <div style={{ padding: "12px" }}>
                      <div
                        style={{
                          fontSize: "13px",
                          fontWeight: 600,
                          color: theme.colors.text,
                          marginBottom: "4px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {album.title}
                      </div>
                      <div
                        style={{
                          fontSize: "11px",
                          color: theme.colors.textMuted,
                        }}
                      >
                        {album.trackCount} tracks
                      </div>
                    </div>
                  </Glass>
                ))}
              </ScrollRow>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default HomeScreen;

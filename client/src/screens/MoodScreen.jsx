import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../contexts/AuthContext";
import { MOODS } from "../constants/themes";
import MoodIcon from "../components/MoodIcon";
import Glass from "../components/Glass";
import * as api from "../services/api";

const MoodScreen = () => {
  const { theme } = useTheme();
  const { updateUser } = useAuth();
  const navigate = useNavigate();

  const [selectedMood, setSelectedMood] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSelectMood = async (mood) => {
    setSelectedMood(mood);
    setLoading(true);

    try {
      await api.updateProfile({ currentMood: mood });
      updateUser({ currentMood: mood });
      setTimeout(() => navigate("/"), 300);
    } catch (error) {
      console.error("Failed to save mood:", error);
      setLoading(false);
    }
  };

  const handleSkip = () => {
    navigate("/");
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px",
        zIndex: 10,
        position: "relative",
      }}
    >
      {/* Header */}
      <div
        style={{
          textAlign: "center",
          marginBottom: "48px",
        }}
      >
        <h1
          style={{
            fontSize: "32px",
            fontWeight: 600,
            color: theme.colors.text,
            marginBottom: "12px",
          }}
        >
          How are you feeling?
        </h1>
        <p
          style={{
            fontSize: "14px",
            color: theme.colors.textMuted,
          }}
        >
          {theme.moment}
        </p>
      </div>

      {/* Mood Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))",
          gap: "24px",
          maxWidth: "600px",
          width: "100%",
          marginBottom: "40px",
        }}
      >
        {MOODS.map((mood) => (
          <button
            key={mood}
            onClick={() => handleSelectMood(mood)}
            disabled={loading}
            style={{
              background:
                selectedMood === mood ? theme.colors.accent : theme.colors.glass,
              border: `1px solid ${
                selectedMood === mood ? theme.colors.accent : theme.colors.glassBorder
              }`,
              borderRadius: theme.cardRadius,
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "12px",
              cursor: loading ? "not-allowed" : "pointer",
              transition: "all 0.2s",
              opacity: loading && selectedMood !== mood ? 0.5 : 1,
            }}
            onMouseEnter={(e) => {
              if (!loading && selectedMood !== mood) {
                e.target.style.background = theme.colors.glassHover;
                e.target.style.transform = "translateY(-2px)";
              }
            }}
            onMouseLeave={(e) => {
              if (selectedMood !== mood) {
                e.target.style.background = theme.colors.glass;
                e.target.style.transform = "translateY(0)";
              }
            }}
          >
            <MoodIcon mood={mood} theme={theme} size={48} />
            <span
              style={{
                fontSize: "12px",
                fontWeight: 500,
                color: selectedMood === mood ? theme.colors.bg1 : theme.colors.text,
              }}
            >
              {theme.moodLabels[mood] || mood}
            </span>
          </button>
        ))}
      </div>

      {/* Skip Button */}
      <button
        onClick={handleSkip}
        disabled={loading}
        style={{
          background: "none",
          color: theme.colors.accent,
          border: `1px solid ${theme.colors.glassBorder}`,
          borderRadius: theme.cardRadius,
          padding: "12px 24px",
          fontSize: "13px",
          cursor: loading ? "not-allowed" : "pointer",
          transition: "all 0.2s",
          opacity: loading ? 0.5 : 1,
        }}
        onMouseEnter={(e) => {
          if (!loading) {
            e.target.style.background = theme.colors.glass;
          }
        }}
        onMouseLeave={(e) => {
          e.target.style.background = "none";
        }}
      >
        Skip for now
      </button>
    </div>
  );
};

export default MoodScreen;

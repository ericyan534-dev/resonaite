import { useState } from "react";
import { useTheme } from "../contexts/ThemeContext";
import { usePlayer } from "../contexts/PlayerContext";
import Glass from "../components/Glass";
import TrackCard from "../components/TrackCard";
import * as api from "../services/api";

const GenerateScreen = () => {
  const { theme } = useTheme();
  const { playTrack } = usePlayer();

  const [mode, setMode] = useState("simple"); // simple or advanced
  const [prompt, setPrompt] = useState("");
  const [bpm, setBpm] = useState(120);
  const [key, setKey] = useState("C");
  const [brightness, setBrightness] = useState(0.5);
  const [density, setDensity] = useState(0.5);
  const [negativePrompt, setNegativePrompt] = useState("");
  const [seed, setSeed] = useState("");

  const [loading, setLoading] = useState(false);
  const [generatedTrack, setGeneratedTrack] = useState(null);
  const [progress, setProgress] = useState(0);
  const [jobId, setJobId] = useState(null);

  const keys = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      alert("Please enter a prompt");
      return;
    }

    setLoading(true);
    setProgress(0);
    setGeneratedTrack(null);

    try {
      const result = await api.startGeneration({
        prompt: prompt.trim(),
        ...(mode === "advanced" && {
          bpm,
          key,
          brightness,
          density,
          negativePrompt,
          seed: seed || undefined,
        }),
      });

      setJobId(result.jobId);

      // Poll for status
      const pollStatus = async () => {
        try {
          const status = await api.getGenerationStatus(result.jobId);
          setProgress(status.progress || 0);

          if (status.status === "completed") {
            setGeneratedTrack(status.track);
            setLoading(false);
          } else if (status.status === "failed") {
            alert("Generation failed: " + (status.error || "Unknown error"));
            setLoading(false);
          } else {
            setTimeout(pollStatus, 2000);
          }
        } catch (error) {
          console.error("Failed to check generation status:", error);
          setLoading(false);
        }
      };

      pollStatus();
    } catch (error) {
      console.error("Failed to start generation:", error);
      alert(error.message || "Generation failed");
      setLoading(false);
    }
  };

  const handleAddToLibrary = async () => {
    if (!generatedTrack) return;

    try {
      await api.addToLibrary(generatedTrack.id);
      alert("Track added to library!");
    } catch (error) {
      console.error("Failed to add to library:", error);
    }
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
      <div style={{ marginBottom: "32px" }}>
        <h1
          style={{
            fontSize: "28px",
            fontWeight: 600,
            color: theme.colors.text,
            marginBottom: "8px",
          }}
        >
          Generate Audio
        </h1>
        <p
          style={{
            fontSize: "13px",
            color: theme.colors.textMuted,
          }}
        >
          Powered by Google Lyria 2
        </p>
      </div>

      {/* Mode Toggle */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          marginBottom: "24px",
        }}
      >
        <button
          onClick={() => setMode("simple")}
          style={{
            background: mode === "simple" ? theme.colors.accent : theme.colors.glass,
            color: mode === "simple" ? theme.colors.bg1 : theme.colors.text,
            border: `1px solid ${
              mode === "simple" ? theme.colors.accent : theme.colors.glassBorder
            }`,
            borderRadius: theme.cardRadius,
            padding: "8px 16px",
            fontSize: "13px",
            fontWeight: 500,
            cursor: "pointer",
            transition: "all 0.2s",
          }}
        >
          Simple
        </button>
        <button
          onClick={() => setMode("advanced")}
          style={{
            background: mode === "advanced" ? theme.colors.accent : theme.colors.glass,
            color: mode === "advanced" ? theme.colors.bg1 : theme.colors.text,
            border: `1px solid ${
              mode === "advanced" ? theme.colors.accent : theme.colors.glassBorder
            }`,
            borderRadius: theme.cardRadius,
            padding: "8px 16px",
            fontSize: "13px",
            fontWeight: 500,
            cursor: "pointer",
            transition: "all 0.2s",
          }}
        >
          Advanced
        </button>
      </div>

      {/* Main Form */}
      <Glass
        theme={theme}
        style={{
          marginBottom: "24px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        {/* Prompt */}
        <div>
          <label
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: theme.colors.textMuted,
              display: "block",
              marginBottom: "8px",
            }}
          >
            Describe Your Sound
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="E.g., 'Peaceful ambient piano with forest sounds, 10 minutes long'"
            style={{
              width: "100%",
              minHeight: "100px",
              background: theme.colors.cardBg,
              border: `1px solid ${theme.colors.glassBorder}`,
              borderRadius: theme.cardRadius,
              padding: "12px",
              color: theme.colors.text,
              fontSize: "13px",
              fontFamily: "Georgia, serif",
              resize: "vertical",
            }}
          />
        </div>

        {/* Advanced Options */}
        {mode === "advanced" && (
          <>
            {/* BPM */}
            <div>
              <label
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  color: theme.colors.textMuted,
                  display: "block",
                  marginBottom: "8px",
                }}
              >
                BPM: {bpm}
              </label>
              <input
                type="range"
                min="40"
                max="180"
                value={bpm}
                onChange={(e) => setBpm(parseInt(e.target.value))}
                style={{ width: "100%", cursor: "pointer" }}
              />
            </div>

            {/* Key */}
            <div>
              <label
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  color: theme.colors.textMuted,
                  display: "block",
                  marginBottom: "8px",
                }}
              >
                Key
              </label>
              <select
                value={key}
                onChange={(e) => setKey(e.target.value)}
                style={{
                  width: "100%",
                  background: theme.colors.cardBg,
                  border: `1px solid ${theme.colors.glassBorder}`,
                  borderRadius: theme.cardRadius,
                  padding: "8px",
                  color: theme.colors.text,
                  fontSize: "13px",
                  fontFamily: "Georgia, serif",
                  cursor: "pointer",
                }}
              >
                {keys.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>

            {/* Brightness */}
            <div>
              <label
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  color: theme.colors.textMuted,
                  display: "block",
                  marginBottom: "8px",
                }}
              >
                Brightness: {brightness.toFixed(2)}
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={brightness}
                onChange={(e) => setBrightness(parseFloat(e.target.value))}
                style={{ width: "100%", cursor: "pointer" }}
              />
            </div>

            {/* Density */}
            <div>
              <label
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  color: theme.colors.textMuted,
                  display: "block",
                  marginBottom: "8px",
                }}
              >
                Density: {density.toFixed(2)}
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={density}
                onChange={(e) => setDensity(parseFloat(e.target.value))}
                style={{ width: "100%", cursor: "pointer" }}
              />
            </div>

            {/* Negative Prompt */}
            <div>
              <label
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  color: theme.colors.textMuted,
                  display: "block",
                  marginBottom: "8px",
                }}
              >
                Negative Prompt (optional)
              </label>
              <textarea
                value={negativePrompt}
                onChange={(e) => setNegativePrompt(e.target.value)}
                placeholder="What to avoid"
                style={{
                  width: "100%",
                  minHeight: "60px",
                  background: theme.colors.cardBg,
                  border: `1px solid ${theme.colors.glassBorder}`,
                  borderRadius: theme.cardRadius,
                  padding: "8px",
                  color: theme.colors.text,
                  fontSize: "13px",
                  fontFamily: "Georgia, serif",
                  resize: "vertical",
                }}
              />
            </div>

            {/* Seed */}
            <div>
              <label
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  color: theme.colors.textMuted,
                  display: "block",
                  marginBottom: "8px",
                }}
              >
                Seed (optional)
              </label>
              <input
                type="text"
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                placeholder="For reproducibility"
                style={{
                  width: "100%",
                  background: theme.colors.cardBg,
                  border: `1px solid ${theme.colors.glassBorder}`,
                  borderRadius: theme.cardRadius,
                  padding: "8px",
                  color: theme.colors.text,
                  fontSize: "13px",
                  fontFamily: "Georgia, serif",
                }}
              />
            </div>
          </>
        )}

        {/* Progress Bar */}
        {loading && (
          <div style={{ width: "100%" }}>
            <div
              style={{
                fontSize: "12px",
                color: theme.colors.textMuted,
                marginBottom: "8px",
              }}
            >
              Generating... {Math.round(progress)}%
            </div>
            <div
              style={{
                width: "100%",
                height: "4px",
                background: theme.colors.cardBg,
                borderRadius: "2px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${progress}%`,
                  background: `linear-gradient(90deg, ${theme.colors.accent}, ${theme.colors.accentSoft})`,
                  animation: "shimmer 1.5s infinite",
                  transition: "width 0.3s",
                }}
              />
            </div>
          </div>
        )}

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={loading || !prompt.trim()}
          style={{
            background: theme.colors.accent,
            color: theme.colors.bg1,
            border: "none",
            borderRadius: theme.cardRadius,
            padding: "12px",
            fontSize: "14px",
            fontWeight: 600,
            cursor: loading || !prompt.trim() ? "not-allowed" : "pointer",
            opacity: loading || !prompt.trim() ? 0.7 : 1,
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            if (!loading && prompt.trim()) e.target.style.transform = "translateY(-2px)";
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = "translateY(0)";
          }}
        >
          {loading ? "Generating..." : "Generate Audio"}
        </button>
      </Glass>

      {/* Generated Track Display */}
      {generatedTrack && (
        <div style={{ marginBottom: "24px" }}>
          <h2
            style={{
              fontSize: "16px",
              fontWeight: 600,
              color: theme.colors.text,
              marginBottom: "16px",
            }}
          >
            Your Generated Track
          </h2>

          <div style={{ maxWidth: "200px", marginBottom: "16px" }}>
            <TrackCard
              track={generatedTrack}
              size="medium"
              onClick={() => playTrack(generatedTrack)}
            />
          </div>

          <button
            onClick={handleAddToLibrary}
            style={{
              background: theme.colors.accentSoft,
              color: theme.colors.bg1,
              border: "none",
              borderRadius: theme.cardRadius,
              padding: "8px 16px",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = "translateY(0)";
            }}
          >
            Add to Library
          </button>
        </div>
      )}

      {/* Footer */}
      <div
        style={{
          fontSize: "11px",
          color: theme.colors.textMuted,
          textAlign: "center",
          marginTop: "40px",
        }}
      >
        Powered by Google Lyria 2
      </div>
    </div>
  );
};

export default GenerateScreen;

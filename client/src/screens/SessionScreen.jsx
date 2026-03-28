import { useState, useEffect } from "react";
import { useTheme } from "../contexts/ThemeContext";
import { usePlayer } from "../contexts/PlayerContext";
import Glass from "../components/Glass";
import { CIM_PRESETS } from "../constants/themes";
import * as api from "../services/api";
import { Play, Pause, SkipForward, SkipBack } from "lucide-react";

const SessionScreen = () => {
  const { theme } = useTheme();
  const { currentTrack, playing, togglePlay, skipNext, skipPrev } = usePlayer();

  const [selectedPreset, setSelectedPreset] = useState(CIM_PRESETS[0].id);
  const [processingStatus, setProcessingStatus] = useState(null);
  const [jobId, setJobId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState(null);

  const currentPreset = CIM_PRESETS.find((p) => p.id === selectedPreset);

  const handleApplyProcessing = async () => {
    if (!currentTrack) {
      alert("Please select a track first");
      return;
    }

    setLoading(true);
    try {
      const result = await api.startProcessing({
        trackId: currentTrack.id,
        preset: selectedPreset,
      });

      setJobId(result.jobId);
      setProcessingStatus("processing");

      // Poll for status
      const pollStatus = async () => {
        try {
          const status = await api.getProcessingStatus(result.jobId);
          if (status.status === "completed") {
            setProcessingStatus("completed");
            setMetrics(status.metrics);
            setLoading(false);
          } else if (status.status === "failed") {
            setProcessingStatus("failed");
            setLoading(false);
          } else {
            setTimeout(pollStatus, 2000);
          }
        } catch (error) {
          console.error("Failed to check processing status:", error);
          setLoading(false);
        }
      };

      pollStatus();
    } catch (error) {
      console.error("Failed to start processing:", error);
      setLoading(false);
    }
  };

  const getTimeRemaining = () => {
    const presetTimeMap = {
      focus_beta_18hz: 45,
      focus_adhd_pink: 60,
      relax_alpha_10hz: 30,
      sleep_delta_2hz: 120,
      sleep_theta_6hz: 90,
    };
    return presetTimeMap[selectedPreset] || 45;
  };

  const timeRemaining = getTimeRemaining();
  const progress = processingStatus === "completed" ? 100 : processingStatus === "processing" ? 50 : 0;

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
        overflow: "auto",
        paddingBottom: "120px",
      }}
    >
      {/* Header */}
      <div
        style={{
          textAlign: "center",
          marginBottom: "40px",
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
          Guided Session
        </h1>
        <p
          style={{
            fontSize: "13px",
            color: theme.colors.textMuted,
          }}
        >
          {currentTrack ? currentTrack.title : "Select a track to begin"}
        </p>
      </div>

      {/* Timer Ring */}
      <div
        style={{
          width: "200px",
          height: "200px",
          borderRadius: "50%",
          background: `conic-gradient(${theme.colors.accent} 0deg ${progress * 3.6}deg, ${theme.colors.glassBorder} ${progress * 3.6}deg)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "40px",
          position: "relative",
        }}
      >
        <div
          style={{
            width: "180px",
            height: "180px",
            borderRadius: "50%",
            background: theme.colors.glass,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            border: `1px solid ${theme.colors.glassBorder}`,
          }}
        >
          <div
            style={{
              fontSize: "32px",
              fontWeight: 700,
              color: theme.colors.accent,
            }}
          >
            {timeRemaining}
          </div>
          <div
            style={{
              fontSize: "12px",
              color: theme.colors.textMuted,
            }}
          >
            minutes
          </div>
        </div>
      </div>

      {/* Current Track Info */}
      {currentTrack && (
        <Glass
          theme={theme}
          style={{
            width: "100%",
            maxWidth: "320px",
            marginBottom: "32px",
            padding: "16px",
          }}
        >
          <div
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: theme.colors.text,
              marginBottom: "4px",
            }}
          >
            {currentTrack.title}
          </div>
          <div
            style={{
              fontSize: "11px",
              color: theme.colors.textMuted,
              marginBottom: "12px",
            }}
          >
            {currentTrack.mood} • {currentTrack.bpm} BPM
          </div>

          {/* Playback Controls */}
          <div
            style={{
              display: "flex",
              gap: "12px",
              justifyContent: "center",
            }}
          >
            <button
              onClick={skipPrev}
              style={{
                background: "none",
                color: theme.colors.accent,
                border: "none",
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
                width: 48,
                height: 48,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              {playing ? (
                <Pause size={20} fill="currentColor" />
              ) : (
                <Play size={20} fill="currentColor" />
              )}
            </button>

            <button
              onClick={skipNext}
              style={{
                background: "none",
                color: theme.colors.accent,
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
              }}
            >
              <SkipForward size={20} />
            </button>
          </div>
        </Glass>
      )}

      {/* CIM Preset Selector */}
      <div style={{ width: "100%", maxWidth: "320px", marginBottom: "32px" }}>
        <label
          style={{
            fontSize: "12px",
            fontWeight: 600,
            color: theme.colors.textMuted,
            display: "block",
            marginBottom: "8px",
          }}
        >
          Frequency Band
        </label>
        <select
          value={selectedPreset}
          onChange={(e) => setSelectedPreset(e.target.value)}
          style={{
            width: "100%",
            background: theme.colors.cardBg,
            border: `1px solid ${theme.colors.glassBorder}`,
            borderRadius: theme.cardRadius,
            padding: "12px",
            color: theme.colors.text,
            fontSize: "13px",
            fontFamily: "Georgia, serif",
            cursor: "pointer",
          }}
        >
          {CIM_PRESETS.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.name} - {preset.hz} Hz ({preset.band})
            </option>
          ))}
        </select>
        <p
          style={{
            fontSize: "11px",
            color: theme.colors.textMuted,
            marginTop: "6px",
          }}
        >
          {currentPreset?.description}
        </p>
      </div>

      {/* Apply Processing Button */}
      <button
        onClick={handleApplyProcessing}
        disabled={loading || !currentTrack}
        style={{
          background: theme.colors.accent,
          color: theme.colors.bg1,
          border: "none",
          borderRadius: theme.cardRadius,
          padding: "12px 32px",
          fontSize: "14px",
          fontWeight: 600,
          cursor: loading || !currentTrack ? "not-allowed" : "pointer",
          opacity: loading || !currentTrack ? 0.7 : 1,
          transition: "all 0.2s",
          marginBottom: "32px",
          width: "100%",
          maxWidth: "320px",
        }}
        onMouseEnter={(e) => {
          if (!loading && currentTrack) e.target.style.transform = "translateY(-2px)";
        }}
        onMouseLeave={(e) => {
          e.target.style.transform = "translateY(0)";
        }}
      >
        {loading ? "Processing..." : "Apply CIM Processing"}
      </button>

      {/* Metrics Display */}
      {metrics && (
        <Glass
          theme={theme}
          style={{
            width: "100%",
            maxWidth: "320px",
          }}
        >
          <div
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: theme.colors.text,
              marginBottom: "12px",
            }}
          >
            Processing Metrics
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "12px",
            }}
          >
            {Object.entries(metrics).map(([key, value]) => (
              <div
                key={key}
                style={{
                  padding: "8px",
                  background: theme.colors.cardBg,
                  borderRadius: theme.cardRadius,
                }}
              >
                <div
                  style={{
                    fontSize: "10px",
                    color: theme.colors.textMuted,
                    marginBottom: "4px",
                  }}
                >
                  {key}
                </div>
                <div
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: theme.colors.accent,
                  }}
                >
                  {typeof value === "number" ? value.toFixed(2) : value}
                </div>
              </div>
            ))}
          </div>
        </Glass>
      )}
    </div>
  );
};

export default SessionScreen;

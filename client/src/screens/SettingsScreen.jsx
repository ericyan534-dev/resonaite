import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../contexts/AuthContext";
import { THEMES } from "../constants/themes";
import Glass from "../components/Glass";
import * as api from "../services/api";

const SettingsScreen = () => {
  const { theme, themeKey, setThemeKey } = useTheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [preferences, setPreferences] = useState({
    llmEnhancing: true,
    analyticsEnabled: true,
  });

  const handleThemeChange = async (newThemeKey) => {
    setThemeKey(newThemeKey);
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const SectionTitle = ({ children }) => (
    <h2
      style={{
        fontSize: "16px",
        fontWeight: 600,
        color: theme.colors.text,
        marginBottom: "16px",
        marginTop: "24px",
      }}
    >
      {children}
    </h2>
  );

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
      <h1
        style={{
          fontSize: "28px",
          fontWeight: 600,
          color: theme.colors.text,
          marginBottom: "32px",
        }}
      >
        Settings
      </h1>

      {/* Theme Section */}
      <div>
        <SectionTitle>Theme</SectionTitle>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: "16px",
          }}
        >
          {Object.entries(THEMES).map(([key, themeData]) => (
            <button
              key={key}
              onClick={() => handleThemeChange(key)}
              style={{
                border: `2px solid ${themeKey === key ? themeData.colors.accent : themeData.colors.glassBorder}`,
                borderRadius: themeData.cardRadius,
                padding: "16px",
                background: themeData.colors.glass,
                cursor: "pointer",
                transition: "all 0.2s",
                textAlign: "center",
              }}
              onMouseEnter={(e) => {
                if (themeKey !== key) {
                  e.target.style.background = themeData.colors.glassHover;
                }
              }}
              onMouseLeave={(e) => {
                if (themeKey !== key) {
                  e.target.style.background = themeData.colors.glass;
                }
              }}
            >
              <div
                style={{
                  width: "100%",
                  height: "60px",
                  borderRadius: themeData.cardRadius,
                  background: `linear-gradient(${themeData.gradientAngle}deg, ${themeData.colors.accent}, ${themeData.colors.bg3})`,
                  marginBottom: "12px",
                }}
              />
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: themeData.colors.text,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {themeData.name}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Preferences Section */}
      <div>
        <SectionTitle>Preferences</SectionTitle>
        <Glass theme={theme} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={preferences.llmEnhancing}
              onChange={(e) =>
                setPreferences({ ...preferences, llmEnhancing: e.target.checked })
              }
              style={{ cursor: "pointer" }}
            />
            <span
              style={{
                fontSize: "13px",
                color: theme.colors.text,
              }}
            >
              Enable LLM-enhanced prompting
            </span>
          </label>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={preferences.analyticsEnabled}
              onChange={(e) =>
                setPreferences({ ...preferences, analyticsEnabled: e.target.checked })
              }
              style={{ cursor: "pointer" }}
            />
            <span
              style={{
                fontSize: "13px",
                color: theme.colors.text,
              }}
            >
              Allow analytics
            </span>
          </label>
        </Glass>
      </div>

      {/* Account Section */}
      <div>
        <SectionTitle>Account</SectionTitle>
        <Glass theme={theme} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div>
            <label
              style={{
                fontSize: "11px",
                fontWeight: 600,
                color: theme.colors.textMuted,
                display: "block",
                marginBottom: "4px",
              }}
            >
              Email
            </label>
            <div
              style={{
                fontSize: "13px",
                color: theme.colors.text,
              }}
            >
              {user?.email}
            </div>
          </div>

          <div>
            <label
              style={{
                fontSize: "11px",
                fontWeight: 600,
                color: theme.colors.textMuted,
                display: "block",
                marginBottom: "4px",
              }}
            >
              Display Name
            </label>
            <div
              style={{
                fontSize: "13px",
                color: theme.colors.text,
              }}
            >
              {user?.displayName}
            </div>
          </div>
        </Glass>
      </div>

      {/* Logout Button */}
      <div style={{ marginTop: "32px" }}>
        <button
          onClick={handleLogout}
          style={{
            width: "100%",
            background: "rgba(220, 38, 38, 0.1)",
            color: "#fca5a5",
            border: "1px solid rgba(220, 38, 38, 0.3)",
            borderRadius: theme.cardRadius,
            padding: "12px",
            fontSize: "14px",
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            e.target.style.background = "rgba(220, 38, 38, 0.2)";
          }}
          onMouseLeave={(e) => {
            e.target.style.background = "rgba(220, 38, 38, 0.1)";
          }}
        >
          Logout
        </button>
      </div>

      {/* Footer */}
      <div
        style={{
          marginTop: "48px",
          paddingTop: "24px",
          borderTop: `1px solid ${theme.colors.glassBorder}`,
          fontSize: "11px",
          color: theme.colors.textMuted,
          textAlign: "center",
        }}
      >
        <div>Resonaite v1.0</div>
        <div style={{ marginTop: "8px" }}>Sound therapy powered by AI</div>
      </div>
    </div>
  );
};

export default SettingsScreen;

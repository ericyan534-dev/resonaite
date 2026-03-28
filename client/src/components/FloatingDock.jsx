import { useNavigate, useLocation } from "react-router-dom";
import { useTheme } from "../contexts/ThemeContext";
import Glass from "./Glass";
import { Home, Zap, Wand2, Library, Settings } from "lucide-react";

const FloatingDock = () => {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const items = [
    { path: "/", icon: Home, label: "Home" },
    { path: "/session", icon: Zap, label: "Session" },
    { path: "/generate", icon: Wand2, label: "Generate" },
    { path: "/library", icon: Library, label: "Library" },
    { path: "/settings", icon: Settings, label: "Settings" },
  ];

  return (
    <Glass
      theme={theme}
      style={{
        position: "fixed",
        bottom: 20,
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        gap: "8px",
        zIndex: 100,
        padding: "8px 12px",
      }}
    >
      {items.map((item) => {
        const isActive = location.pathname === item.path;
        return (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            style={{
              background: isActive ? theme.colors.accent : "transparent",
              color: isActive ? theme.colors.bg1 : theme.colors.accent,
              border: "none",
              borderRadius: theme.cardRadius,
              padding: "8px 12px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              cursor: "pointer",
              transition: "all 0.2s",
              fontSize: "12px",
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.target.style.background = theme.colors.glassHover;
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.target.style.background = "transparent";
              }
            }}
          >
            <item.icon size={16} />
            <span style={{ fontWeight: 500 }}>{item.label}</span>
          </button>
        );
      })}
    </Glass>
  );
};

export default FloatingDock;

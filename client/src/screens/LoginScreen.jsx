import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import Glass from "../components/Glass";

const LoginScreen = () => {
  const { theme } = useTheme();
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState("login"); // login or register
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(email, password, displayName);
      }
      navigate("/mood");
    } catch (err) {
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        zIndex: 10,
        position: "relative",
      }}
    >
      <Glass
        theme={theme}
        style={{
          width: "100%",
          maxWidth: "400px",
          padding: "40px",
        }}
      >
        {/* Logo */}
        <div
          style={{
            textAlign: "center",
            marginBottom: "32px",
          }}
        >
          <div
            style={{
              fontSize: "32px",
              fontWeight: 700,
              color: theme.colors.accent,
              marginBottom: "8px",
            }}
          >
            Resonaite
          </div>
          <div
            style={{
              fontSize: "14px",
              color: theme.colors.textMuted,
            }}
          >
            Sound Therapy
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {mode === "register" && (
            <input
              type="text"
              placeholder="Display Name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required={mode === "register"}
              style={{
                background: theme.colors.cardBg,
                border: `1px solid ${theme.colors.glassBorder}`,
                borderRadius: theme.cardRadius,
                padding: "12px",
                color: theme.colors.text,
                fontSize: "14px",
                fontFamily: "Georgia, serif",
              }}
            />
          )}

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              background: theme.colors.cardBg,
              border: `1px solid ${theme.colors.glassBorder}`,
              borderRadius: theme.cardRadius,
              padding: "12px",
              color: theme.colors.text,
              fontSize: "14px",
              fontFamily: "Georgia, serif",
            }}
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{
              background: theme.colors.cardBg,
              border: `1px solid ${theme.colors.glassBorder}`,
              borderRadius: theme.cardRadius,
              padding: "12px",
              color: theme.colors.text,
              fontSize: "14px",
              fontFamily: "Georgia, serif",
            }}
          />

          {error && (
            <div
              style={{
                background: "rgba(220, 38, 38, 0.1)",
                border: "1px solid rgba(220, 38, 38, 0.3)",
                borderRadius: theme.cardRadius,
                padding: "12px",
                color: "#fca5a5",
                fontSize: "13px",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              background: theme.colors.accent,
              color: theme.colors.bg1,
              border: "none",
              borderRadius: theme.cardRadius,
              padding: "12px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              if (!loading) e.target.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = "translateY(0)";
            }}
          >
            {loading ? "Loading..." : mode === "login" ? "Login" : "Register"}
          </button>

          <button
            type="button"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError("");
            }}
            style={{
              background: "none",
              color: theme.colors.accent,
              border: "none",
              padding: "8px",
              fontSize: "13px",
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            {mode === "login" ? "Need an account? Register" : "Have an account? Login"}
          </button>
        </form>
      </Glass>
    </div>
  );
};

export default LoginScreen;

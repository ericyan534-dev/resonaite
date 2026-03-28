import React, { createContext, useContext, useState, useEffect } from "react";
import { THEMES } from "../constants/themes";
import * as api from "../services/api";

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [themeKey, setThemeKeyState] = useState(() => {
    return localStorage.getItem("resonaite_theme") || "forest";
  });

  const theme = THEMES[themeKey] || THEMES.forest;

  const setThemeKey = async (newThemeKey) => {
    setThemeKeyState(newThemeKey);
    localStorage.setItem("resonaite_theme", newThemeKey);

    try {
      await api.updateProfile({ theme: newThemeKey });
    } catch (error) {
      console.error("Failed to save theme preference:", error);
    }
  };

  return (
    <ThemeContext.Provider value={{ themeKey, theme, setThemeKey }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
};

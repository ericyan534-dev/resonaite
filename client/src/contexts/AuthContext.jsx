import React, { createContext, useContext, useState, useEffect } from "react";
import * as api from "../services/api";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setTokenState] = useState(api.getToken());

  // Check token validity on mount
  useEffect(() => {
    const checkAuth = async () => {
      const existingToken = api.getToken();
      if (existingToken) {
        try {
          const userData = await api.getMe();
          if (userData) {
            setUser(userData);
            setTokenState(existingToken);
          } else {
            api.clearToken();
            setTokenState(null);
          }
        } catch (error) {
          console.error("Auth check failed:", error);
          api.clearToken();
          setTokenState(null);
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  const login = async (email, password) => {
    try {
      const data = await api.login(email, password);
      setUser(data.user);
      setTokenState(data.token);
      return data;
    } catch (error) {
      console.error("Login failed:", error);
      throw error;
    }
  };

  const register = async (email, password, displayName) => {
    try {
      const data = await api.register(email, password, displayName);
      setUser(data.user);
      setTokenState(data.token);
      return data;
    } catch (error) {
      console.error("Register failed:", error);
      throw error;
    }
  };

  const logout = () => {
    api.clearToken();
    setUser(null);
    setTokenState(null);
  };

  const updateUser = (updates) => {
    setUser({ ...user, ...updates });
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, token, login, register, logout, updateUser }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};

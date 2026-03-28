const TOKEN_KEY = "resonaite_token";

// Token management
export const getToken = () => {
  return localStorage.getItem(TOKEN_KEY);
};

export const setToken = (token) => {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
};

export const clearToken = () => {
  localStorage.removeItem(TOKEN_KEY);
};

// Base fetch function
export const apiFetch = async (url, options = {}) => {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    clearToken();
    window.location.href = "/login";
    return null;
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `API error: ${response.status}`);
  }

  return response.json();
};

// Auth endpoints
export const login = async (email, password) => {
  const data = await apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (data?.token) {
    setToken(data.token);
  }
  return data;
};

export const register = async (email, password, displayName) => {
  const data = await apiFetch("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, displayName }),
  });
  if (data?.token) {
    setToken(data.token);
  }
  return data;
};

export const getMe = async () => {
  return apiFetch("/auth/me", { method: "GET" });
};

// Track endpoints
export const getTracks = async (filters = {}) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      params.append(key, value);
    }
  });
  const query = params.toString();
  return apiFetch(`/api/tracks${query ? "?" + query : ""}`, { method: "GET" });
};

export const getTrack = async (id) => {
  return apiFetch(`/api/tracks/${id}`, { method: "GET" });
};

export const getTrackStreamUrl = (id) => {
  return `/api/tracks/${id}/stream`;
};

// Album endpoints
export const getAlbums = async () => {
  return apiFetch("/api/albums", { method: "GET" });
};

export const getAlbum = async (id) => {
  return apiFetch(`/api/albums/${id}`, { method: "GET" });
};

// Library endpoints
export const getLibrary = async () => {
  return apiFetch("/api/library", { method: "GET" });
};

export const addToLibrary = async (trackId) => {
  return apiFetch(`/api/library/${trackId}`, {
    method: "POST",
  });
};

export const removeFromLibrary = async (trackId) => {
  return apiFetch(`/api/library/${trackId}`, {
    method: "DELETE",
  });
};

export const updateLibraryTrack = async (trackId, data) => {
  return apiFetch(`/api/library/${trackId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
};

// Generation endpoints
export const startGeneration = async (data) => {
  return apiFetch("/api/generate", {
    method: "POST",
    body: JSON.stringify(data),
  });
};

export const getGenerationStatus = async (jobId) => {
  return apiFetch(`/api/generate/${jobId}`, { method: "GET" });
};

// Processing endpoints
export const startProcessing = async (data) => {
  return apiFetch("/api/process", {
    method: "POST",
    body: JSON.stringify(data),
  });
};

export const getProcessingStatus = async (jobId) => {
  return apiFetch(`/api/process/${jobId}`, { method: "GET" });
};

// User endpoints
export const updateProfile = async (data) => {
  return apiFetch("/api/users/me", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
};

export const getHistory = async () => {
  return apiFetch("/api/users/me/history", { method: "GET" });
};

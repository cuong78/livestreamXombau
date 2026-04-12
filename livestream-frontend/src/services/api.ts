import axios from "axios";
import type {
  Stream,
  DailyRecording,
  UserLocation,
  SaveLocationRequest,
} from "@/types";

const API_BASE_URL = "/api";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

/**
 * Decode JWT token and check if it's expired
 */
export const isTokenExpired = (token: string): boolean => {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const expiry = payload.exp * 1000; // Convert to milliseconds
    return Date.now() >= expiry;
  } catch {
    return true; // If can't decode, treat as expired
  }
};

/**
 * Check token validity and auto-logout if expired
 * Returns true if token is valid, false if expired/missing
 */
export const checkTokenAndLogout = (): boolean => {
  const token = localStorage.getItem("admin_token");
  if (!token) return false;

  if (isTokenExpired(token)) {
    // Token expired → clear everything and logout
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_user");
    localStorage.removeItem("refresh_token");
    return false;
  }
  return true;
};

// Add auth token to requests (check expiry before sending)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("admin_token");
  if (token) {
    if (isTokenExpired(token)) {
      // Token expired → clear and don't send
      localStorage.removeItem("admin_token");
      localStorage.removeItem("admin_user");
      localStorage.removeItem("refresh_token");
      window.location.reload();
      return Promise.reject(new Error("Token expired"));
    }
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401/403 errors → simple auto-logout
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      // Unauthorized → clear tokens and reload
      localStorage.removeItem("admin_token");
      localStorage.removeItem("admin_user");
      localStorage.removeItem("refresh_token");
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: async (username: string, password: string) => {
    const response = await api.post("/auth/login", { username, password });
    if (response.data.token) {
      localStorage.setItem("admin_token", response.data.token);
    }
    if (response.data.refreshToken) {
      localStorage.setItem("refresh_token", response.data.refreshToken);
    }
    if (response.data.user) {
      localStorage.setItem("admin_user", JSON.stringify(response.data.user));
    }
    return response.data;
  },

  logout: async () => {
    const refreshToken = localStorage.getItem("refresh_token");
    try {
      await api.post("/auth/logout", { refreshToken });
    } catch {
      // Ignore errors on logout
    }
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_user");
    localStorage.removeItem("refresh_token");
  },
};

export const streamApi = {
  getCurrentStream: async (): Promise<Stream | null> => {
    const response = await axios.get(`${API_BASE_URL}/stream/current`);
    return response.data;
  },
};

export const recordingApi = {
  // Get recent recordings (last 3 days)
  getRecentRecordings: async (): Promise<DailyRecording[]> => {
    const response = await axios.get(`${API_BASE_URL}/recordings/recent`);
    return response.data;
  },

  // Get recording by specific date
  getRecordingByDate: async (date: string): Promise<DailyRecording | null> => {
    const response = await axios.get(`${API_BASE_URL}/recordings/date/${date}`);
    return response.data;
  },

  // Admin: Trigger merge for today's recordings
  triggerMerge: async (
    date: string
  ): Promise<{ success: boolean; message: string }> => {
    const response = await api.post(`/recordings/admin/merge/${date}`);
    return response.data;
  },

  // Admin: Delete recording by date
  deleteRecording: async (
    date: string
  ): Promise<{ success: boolean; message: string }> => {
    const response = await api.delete(`/recordings/admin/delete/${date}`);
    return response.data;
  },
};

export const locationApi = {
  // Save user location
  saveLocation: async (request: SaveLocationRequest): Promise<UserLocation> => {
    const response = await axios.post(`${API_BASE_URL}/location`, request);
    return response.data;
  },

  // Get current user location
  getCurrentLocation: async (): Promise<UserLocation | null> => {
    const response = await api.get(`/location/current`);
    return response.data;
  },

  // Get location history
  getLocationHistory: async (): Promise<UserLocation[]> => {
    const response = await api.get(`/location/history`);
    return response.data;
  },
};

export default api;

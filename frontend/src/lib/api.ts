import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api/v1",
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor: attach bearer token automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: sanitize errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // 1. Check if backend returned a clean JSON error response
    if (error.response?.data?.message) {
      return Promise.reject(error);
    }

    // 2. Handle network disconnection / server unreachable
    if (!error.response) {
      const networkError = new Error(
        "Unable to connect to the server. Please check your internet connection."
      );
      return Promise.reject(networkError);
    }

    // 3. Fallback for unhandled HTTP status codes
    const status = error.response.status;
    let fallbackMessage = "An unexpected error occurred. Please try again.";

    if (status === 401) fallbackMessage = "Session expired. Please log in again.";
    else if (status === 403) fallbackMessage = "You do not have permission to perform this action.";
    else if (status === 404) fallbackMessage = "The requested item was not found.";
    else if (status >= 500) fallbackMessage = "Server encountered an error. Please try again shortly.";

    error.response.data = {
      status: "error",
      message: fallbackMessage,
    };

    return Promise.reject(error);
  }
);
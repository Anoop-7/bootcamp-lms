import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api/v1",
  withCredentials: true,
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

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Response interceptor: handles silent token refresh with thundering herd queue + sanitized errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Check if 401 Unauthorized and request has not already retried
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      const url = originalRequest.url || "";
      const isAuthEndpoint =
        url.includes("/auth/login") ||
        url.includes("/auth/register") ||
        url.includes("/auth/refresh") ||
        url.includes("/auth/forgot-password") ||
        url.includes("/auth/reset-password");

      if (isAuthEndpoint) {
        // If refresh endpoint failed with 401, clear stored auth data and redirect to login
        if (url.includes("/auth/refresh")) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
            window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
          }
        }
        return Promise.reject(error);
      }

      // If already refreshing, queue this request
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((newToken) => {
            if (newToken && originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
            }
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const baseURL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api/v1";
        // Perform refresh request via raw axios with credentials enabled
        const refreshRes = await axios.post(
          `${baseURL}/auth/refresh`,
          {},
          { withCredentials: true }
        );

        const newAccessToken = refreshRes.data?.data?.accessToken || refreshRes.data?.data?.token;
        if (!newAccessToken) {
          throw new Error("No access token returned from session refresh");
        }

        localStorage.setItem("token", newAccessToken);
        if (refreshRes.data?.data?.user) {
          localStorage.setItem("user", JSON.stringify(refreshRes.data.data.user));
        }

        processQueue(null, newAccessToken);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }
        return api(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
          window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
        }
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

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
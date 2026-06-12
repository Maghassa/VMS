import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

export const api = axios.create({ baseURL: API_URL });

// Attach token
api.interceptors.request.use((config) => {
  const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-refresh on 401 (but never for auth endpoints — a failed login must
// surface its error to the form, not trigger a redirect loop)
api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const url: string = error.config?.url || "";
    const isAuthRoute = url.includes("/auth/");
    if (error.response?.status === 401 && !error.config._retry && !isAuthRoute) {
      error.config._retry = true;
      const refreshToken = localStorage.getItem("refreshToken");
      if (refreshToken) {
        try {
          const res = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
          localStorage.setItem("accessToken", res.data.accessToken);
          error.config.headers.Authorization = `Bearer ${res.data.accessToken}`;
          return api(error.config);
        } catch {
          localStorage.clear();
          window.location.href = "/login";
        }
      } else {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

/** Extract a human-readable message from an API error. */
export function apiErrorMessage(err: unknown, fallback = "Something went wrong. Please try again.") {
  const e = err as { response?: { data?: { error?: string } }; message?: string };
  if (e?.response?.data?.error) return e.response.data.error;
  if (e?.message === "Network Error") return "Cannot reach the server. Check your connection.";
  return fallback;
}

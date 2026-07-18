import axios from "axios";

/* The JWT lives in localStorage — a deliberate trade-off for a two-user internal
   tool (plan.md Module 8), not an oversight. */
const TOKEN_KEY = "payroll_token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token) => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000",
});

client.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/* On a 401 anywhere, drop the token and bounce to /login. A full-page assign
   rather than a router navigate: the interceptor lives outside React, and this
   also clears any stale in-memory state from the expired session. The redirect
   is suppressed on /auth/login itself, where a 401 just means "wrong password"
   and must render inline on the form instead. */
client.interceptors.response.use(
  (response) => response,
  (error) => {
    const isLoginAttempt = error.config?.url?.includes("/auth/login");
    if (error.response?.status === 401 && !isLoginAttempt) {
      clearToken();
      if (window.location.pathname !== "/login") {
        window.location.assign("/login");
      }
    }
    return Promise.reject(error);
  }
);

/* FastAPI errors arrive as {detail: string} or, for 422 validation failures,
   {detail: [{msg, loc}, ...]}. Both shapes get flattened to one sentence the
   UI can show verbatim — design.md §7: say what happened, not "Invalid input." */
export function errorMessage(error, fallback = "Something went wrong.") {
  const detail = error?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    return detail.map((d) => d.msg ?? String(d)).join("; ");
  }
  if (error?.message === "Network Error") {
    return "Cannot reach the server. Is the backend running?";
  }
  return fallback;
}

export default client;

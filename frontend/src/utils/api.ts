// src/utils/api.ts
import axios, {
  AxiosError,
  AxiosHeaders,
  InternalAxiosRequestConfig,
  AxiosResponse,
} from "axios";
import { getToken } from "./auth";

/* ----------------------------- helpers ----------------------------- */

function isFormDataLike(v: any): v is FormData {
  if (!v) return false;
  if (typeof FormData !== "undefined" && v instanceof FormData) return true;
  return String(v?.constructor?.name).toLowerCase() === "formdata";
}

/* ------------------------------ client ----------------------------- */

export const api = axios.create({
  baseURL:
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ||
    "http://127.0.0.1:8000",
  withCredentials: false,
  timeout: 60_000,
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  // Ensure headers is an AxiosHeaders instance
  const headers =
    (config.headers =
      config.headers instanceof AxiosHeaders
        ? config.headers
        : new AxiosHeaders(config.headers));

  // Bearer
  const token = getToken?.();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  // Always accept JSON
  if (!headers.has("Accept")) headers.set("Accept", "application/json");

  // Content-Type rules
  const isForm = isFormDataLike(config.data);
  if (isForm) {
    // Let browser set multipart boundary
    if (headers.has("Content-Type")) headers.delete("Content-Type");
  } else {
    if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  }

  return config;
});

api.interceptors.response.use(
  (res: AxiosResponse) => res,
  (error: AxiosError<any>) => {
    if (error.response?.data?.detail) {
      error.message =
        typeof error.response.data.detail === "string"
          ? error.response.data.detail
          : JSON.stringify(error.response.data.detail);
    }
    return Promise.reject(error);
  }
);

/* ---------------------------- fetch helpers ---------------------------- */

export type CurrentUser = { id?: number; username?: string; email?: string } | null;

/**
 * Try common "current user" endpoints; fall back to /history (which returns { user, speeches }).
 */
export async function fetchCurrentUser(): Promise<CurrentUser> {
  const candidates = ["/me", "/me/", "/users/me", "/user/me", "/profile/me"];

  // Try the likely endpoints first
  for (const path of candidates) {
    try {
      const { data } = await api.get(path);
      // If the backend returns a plain user object, pass it through
      if (data && (data.username || data.email || data.id)) return data;
    } catch (e: any) {
      // Ignore 404s and try next; rethrow other errors
      if (e?.response?.status && e.response.status !== 404) throw e;
    }
  }

  // ✅ Fallback: /history returns { user: <username>, speeches: [...] }
  try {
    const { data } = await api.get("/history");
    if (data && typeof data.user === "string") {
      return { username: data.user };
    }
    // Some backends may return just an array (speeches) — no user info
    return null;
  } catch (e) {
    return null;
  }
}

export async function fetchSpeeches() {
  try {
    const { data } = await api.get("/speeches");
    return data; // expect an array or { speeches: [...] }
  } catch (e: any) {
    if (e?.response?.status === 404) {
      const { data } = await api.get("/history");
      return data;
    }
    throw e;
  }
}

export async function fetchSpeechById(id: number | string) {
  try {
    const { data } = await api.get(`/speeches/${id}`);
    return data;
  } catch (e: any) {
    if (e?.response?.status === 404) {
      const { data } = await api.get(`/history/${id}`);
      return data;
    }
    throw e;
  }
}

export async function fetchSpeechDetail(id: number | string) {
  try {
    const { data } = await api.get(`/speeches/${id}`);
    return data; // { id, transcript, created_at, feedback: {...} }
  } catch (e: any) {
    // Fallback: get all and find one
    const { data } = await api.get("/history");
    const speeches = Array.isArray(data) ? data : (data?.speeches ?? []);
    const found = speeches.find((s: any) => String(s.id) === String(id));
    if (!found) throw e;
    return found;
  }
}

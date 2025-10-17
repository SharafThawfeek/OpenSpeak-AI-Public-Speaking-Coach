// src/utils/auth.ts
import { api } from "./api";

const isBrowser = () => typeof window !== "undefined";

/* ---------------------------- Token utilities ---------------------------- */

export const setToken = (token: string) => {
  if (!isBrowser()) return;
  localStorage.setItem("token", token);
  // notify other tabs / listeners
  window.dispatchEvent(new StorageEvent("storage", { key: "token", newValue: token }));
};

export const getToken = () => {
  if (!isBrowser()) return null;
  return localStorage.getItem("token");
};

export const removeToken = () => {
  if (!isBrowser()) return;
  localStorage.removeItem("token");
  window.dispatchEvent(new StorageEvent("storage", { key: "token", newValue: null }));
};

export const isLoggedIn = () => !!getToken();

/* --------------------------------- Auth --------------------------------- */

/**
 * Login against FastAPI.
 * Your backend expects: POST /login (form-encoded: email, password)
 * and returns: { access_token: string, token_type: "bearer" }
 */
export async function login(email: string, password: string) {
  const body = new URLSearchParams();
  body.set("email", email);
  body.set("password", password);

  const { data } = await api.post("/login", body.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  const token: string = data?.access_token;
  if (!token) throw new Error("No token returned from server");
  setToken(token);
  return token;
}

/**
 * Signup against FastAPI.
 * Your backend expects: POST /signup (form-encoded: username, email, password)
 * Adjust your signup page to pass a username value.
 */
export async function signup(username: string, email: string, password: string) {
  const body = new URLSearchParams();
  body.set("username", username);
  body.set("email", email);
  body.set("password", password);

  const { data } = await api.post("/signup", body.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  return data;
}

export function logout() {
  removeToken();
  if (isBrowser()) window.location.href = "/login";
}

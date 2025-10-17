import { useEffect, useState } from "react";
import { getToken, removeToken } from "@/utils/auth";

const isBrowser = () => typeof window !== "undefined";

export function useAuth() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => !!getToken());

  useEffect(() => {
    if (!isBrowser()) return;

    const checkAuth = () => setIsLoggedIn(!!getToken());

    // run on mount + when tab refocuses or localStorage changes
    checkAuth();
    window.addEventListener("storage", checkAuth);
    window.addEventListener("focus", checkAuth);

    return () => {
      window.removeEventListener("storage", checkAuth);
      window.removeEventListener("focus", checkAuth);
    };
  }, []);

  const logout = () => {
    removeToken();
    setIsLoggedIn(false);
    if (isBrowser()) window.location.href = "/login";
  };

  return { isLoggedIn, logout };
}

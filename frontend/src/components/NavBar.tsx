// src/components/NavBar.tsx
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getToken, logout as doLogout } from "@/utils/auth";
import { fetchCurrentUser } from "@/utils/api"; // ⬅️ use the helper

type Me = { id?: number; username?: string; email?: string } | null;

export default function NavBar() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<Me>(null);

  useEffect(() => {
    const read = () => setToken(getToken() || null);
    read();
    window.addEventListener("storage", read);
    window.addEventListener("focus", read);
    return () => {
      window.removeEventListener("storage", read);
      window.removeEventListener("focus", read);
    };
  }, []);

  useEffect(() => {
    if (!token) {
      setUser(null);
      return;
    }
    (async () => {
      try {
        const me = await fetchCurrentUser();  // ⬅️ use fallback logic
        setUser(me);
      } catch {
        setUser(null);
      }
    })();
  }, [token]);

  const displayName = useMemo(() => {
    if (!user) return "Speaker";
    if (user.username && user.username.trim()) return user.username;
    if (user.email) return user.email.split("@")[0];
    return "Speaker";
  }, [user]);

  const initials = useMemo(() => {
    const name = (user?.username || user?.email || "S").trim();
    const parts = name.replace(/[@._-].*$/, "").split(/\s+/).filter(Boolean);
    const a = parts[0]?.[0] || "S";
    const b = parts[1]?.[0] || "";
    return (a + b).toUpperCase();
  }, [user]);

  return (
    <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/70 backdrop-blur">
      <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
        <Link href={token ? "/dashboard" : "/"} className="text-lg font-extrabold tracking-tight">
          <span className="text-white">Open</span>
          <span className="text-cyan-400">Speak</span>
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-slate-300">
          <Link className="hover:text-cyan-400 transition" href="/analyze">Analyze</Link>
          <Link className="hover:text-cyan-400 transition" href="/generate">Generate</Link>
          <Link className="hover:text-cyan-400 transition" href="/history">History</Link>
          <Link className="hover:text-cyan-400 transition" href="/progress">Progress</Link>
          <Link className="hover:text-cyan-400 transition" href="/profile">Profile</Link>

          {!token ? (
            <Link
              href="/login"
              className="rounded-lg border border-slate-700 px-3 py-1.5 hover:border-cyan-500 hover:text-cyan-400 transition"
            >
              Login
            </Link>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-slate-800 grid place-items-center text-xs font-bold text-slate-200 border border-slate-700">
                  {initials}
                </div>
                <span className="text-sm text-slate-300">{displayName}</span>
              </div>
              <button
                onClick={() => doLogout()}
                className="rounded-lg border border-slate-700 px-3 py-1.5 hover:border-red-500 hover:text-red-400 transition"
              >
                Logout
              </button>
            </div>
          )}
        </nav>

        {/* Mobile */}
        <div className="md:hidden">
          <Link
            href={token ? "/profile" : "/login"}
            className="rounded-lg border border-slate-700 px-3 py-1.5 hover:border-cyan-500 hover:text-cyan-400 transition"
          >
            {token ? "Menu" : "Login"}
          </Link>
        </div>
      </div>
    </header>
  );
}

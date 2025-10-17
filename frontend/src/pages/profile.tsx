// src/pages/profile.tsx
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { api } from "@/utils/api";
import { getToken, logout as doLogout } from "@/utils/auth";

type Me = {
  username?: string | null;
  email?: string | null;
  created_at?: string | null; // not available from backend, kept for future
};

function asErrorMessage(e: any): string {
  const detail = e?.response?.data?.detail;
  if (Array.isArray(detail)) {
    const msgs = detail
      .map((d: any) => d?.msg ?? (typeof d === "string" ? d : JSON.stringify(d)))
      .filter(Boolean);
    if (msgs.length) return msgs.join(" • ");
  }
  if (typeof detail === "string") return detail;
  if (detail && typeof detail === "object" && "msg" in detail) return String(detail.msg);
  if (e?.message) return String(e.message);
  return "Request failed.";
}

/**
 * Fetch current user from available backend routes:
 * - /history => { user: <username>, speeches: [...] }
 * - /test-auth => "Authenticated as: <email>"
 * We combine these to build a Me object.
 */
async function fetchMeFromBackend(): Promise<Me> {
  let username: string | null = null;
  let email: string | null = null;

  try {
    // Try /history for username
    const { data } = await api.get("/history");
    if (data && typeof data.user === "string") {
      username = data.user || null;
    }
  } catch (_) {
    // ignore; we'll still try /test-auth
  }

  try {
    // Try /test-auth for email (plain text)
    const res = await api.get("/test-auth", { responseType: "text" as any });
    const txt = String(res.data || "");
    // Expect: "Authenticated as: email@domain"
    const m = txt.match(/Authenticated as:\s*(.+)$/i);
    if (m && m[1]) email = m[1].trim();
  } catch (_) {
    // ignore
  }

  if (!username && !email) {
    throw new Error("Could not fetch user details from backend endpoints.");
  }
  return { username, email, created_at: null };
}

export default function ProfilePage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  // user data (read-only)
  const [me, setMe] = useState<Me | null>(null);
  const [loadingMe, setLoadingMe] = useState(true);
  const [errMe, setErrMe] = useState<string | null>(null);

  // ---- auth guard
  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    setReady(true);
  }, [router]);

  // ---- fetch current user via available routes
  useEffect(() => {
    if (!ready) return;
    (async () => {
      setLoadingMe(true);
      setErrMe(null);
      try {
        const me = await fetchMeFromBackend();
        setMe(me);
      } catch (e: any) {
        const status = e?.response?.status;
        if (status === 401) {
          doLogout();
          return;
        }
        setErrMe(asErrorMessage(e));
        setMe(null);
      } finally {
        setLoadingMe(false);
      }
    })();
  }, [ready]);

  const displayName = useMemo(() => {
    if (!me) return "Speaker";
    if (me.username && me.username.trim()) return me.username;
    if (me.email) return me.email.split("@")[0];
    return "Speaker";
  }, [me]);

  const initials = useMemo(() => {
    const seed = (me?.username || me?.email || "S").trim();
    const parts = seed.replace(/[@._-].*$/, "").split(/\s+/).filter(Boolean);
    const a = parts[0]?.[0] || "S";
    const b = parts[1]?.[0] || "";
    return (a + b).toUpperCase();
  }, [me]);

  if (!ready) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <main className="mx-auto max-w-5xl px-6 py-8">
        <h1 className="text-3xl font-extrabold mb-6">Profile</h1>

        {/* Status / errors */}
        {loadingMe && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 mb-6">
            Loading your profile…
          </div>
        )}
        {errMe && (
          <div className="rounded-2xl border border-red-600 bg-red-600/10 p-6 mb-6 text-red-300">
            {errMe}
          </div>
        )}

        {/* Profile card */}
        {me && !loadingMe && (
          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 mb-8">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-full bg-slate-800 grid place-items-center text-sm font-bold text-slate-200 border border-slate-700">
                {initials}
              </div>
              <div>
                <div className="text-xl font-semibold">{displayName}</div>
                <div className="text-slate-400 text-sm">
                  {me.email || "No email"}
                  {me.created_at ? (
                    <span className="ml-2">• Member since {new Date(me.created_at).toLocaleDateString()}</span>
                  ) : null}
                </div>
              </div>
              <div className="ml-auto">
                <button
                  onClick={() => doLogout()}
                  className="rounded-lg border border-slate-700 px-3 py-1.5 hover:border-red-500 hover:text-red-400 transition"
                >
                  Logout
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Read-only note since backend lacks update endpoints */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 mb-8">
          <h2 className="text-xl font-semibold mb-2">Profile editing</h2>
          <p className="text-slate-300">
            Hi! there
          </p>
        </section>

        <footer className="mx-auto max-w-7xl px-0 py-10 text-sm text-slate-500">
          © {new Date().getFullYear()} OpenSpeak. All rights reserved.
        </footer>
      </main>
    </div>
  );
}

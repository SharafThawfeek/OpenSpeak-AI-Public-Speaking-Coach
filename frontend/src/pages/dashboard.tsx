// src/pages/dashboard.tsx
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import Layout from "@/components/Layout";
import { getToken, logout as doLogout } from "@/utils/auth";
import { api } from "@/utils/api";

/* ------------------------------- Types ------------------------------- */

type Me = { id?: number; username?: string; email?: string } | null;

type Section =
  | { summary?: string; strengths?: string[]; weaknesses?: string[]; score?: number | null }
  | string
  | null
  | undefined;

type Feedback = {
  opening?: Section;
  content?: Section;
  delivery?: Section;
  grammar?: Section;
  overall?: Section;
  scores?: Partial<Record<"opening" | "content" | "delivery" | "grammar" | "overall", number | null>>;
};

type HistoryItem = {
  id: number;
  transcript?: string;
  created_at?: string;
  feedback?: Feedback;
};

/* ---------------------------- Small helpers --------------------------- */

function scoreOf(fb: Feedback | undefined, key: keyof NonNullable<Feedback["scores"]>) {
  if (!fb) return null;
  // live analyze often embeds score in section; history may put into fb.scores
  const sec = (fb as any)[key] as Section;
  let inline: number | null | undefined = null;
  if (sec && typeof sec === "object" && "score" in sec) inline = (sec as any).score;
  const fromBlock = fb.scores
  return (inline ?? fromBlock) ?? null;
}

function toDate(v?: string) {
  return v ? new Date(v) : null;
}

function calcStreak(items: HistoryItem[]) {
  if (items.length === 0) return 0;
  const days = Array.from(
    new Set(
      items
        .map((it) => {
          const d = toDate(it.created_at);
          if (!d) return null;
          return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        })
        .filter(Boolean) as number[]
    )
  ).sort((a, b) => a - b);

  if (days.length === 0) return 0;
  let s = 0;
  let cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  for (;;) {
    const ts = cursor.getTime();
    if (days.includes(ts)) {
      s += 1;
      cursor = new Date(ts - 24 * 3600 * 1000);
    } else {
      break;
    }
  }
  return s;
}

/* -------------------------------- Page -------------------------------- */

export default function Dashboard() {
  const router = useRouter();

  // auth + user
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<Me>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  // history for stats
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [historyErr, setHistoryErr] = useState<string | null>(null);

  // --- Auth guard + fetch current user ---
  useEffect(() => {
    let cancelled = false;
    if (!router.isReady) return;

    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    setReady(true);

    const fetchMe = async () => {
      try {
        setLoadingUser(true);
        const { data } = await api.get("/me");
        if (!cancelled) setUser(data || null);
      } catch (e: any) {
        const status = e?.response?.status;
        if (status === 401) {
          doLogout();
          return;
        }
        // fallback: /users/me
        try {
          const { data } = await api.get("/users/me");
          if (!cancelled) setUser(data || null);
        } catch {
          if (!cancelled) setUser(null);
        }
      } finally {
        if (!cancelled) setLoadingUser(false);
      }
    };

    fetchMe();
    return () => {
      cancelled = true;
    };
  }, [router.isReady, router]);

  // --- Fetch history for stats/recents ---
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    (async () => {
      setLoadingHistory(true);
      setHistoryErr(null);
      try {
        const { data } = await api.get("/history");
        const list: HistoryItem[] = Array.isArray(data) ? data : (data?.speeches ?? []);
        if (!cancelled) setHistory(list || []);
      } catch (e: any) {
        if (!cancelled)
          setHistoryErr(
            e?.response?.data?.detail
              ? String(e.response.data.detail)
              : e?.message || "Failed to load history."
          );
      } finally {
        if (!cancelled) setLoadingHistory(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready]);

  // --- Derived: display name ---
  const displayName = useMemo(() => {
    if (loadingUser) return "Loading…";
    if (!user) return "Speaker";
    if (user.username && user.username.trim()) return user.username;
    if (user.email) return user.email.split("@")[0];
    return "Speaker";
  }, [user, loadingUser]);

  // --- Derived: stats from history ---
  const stats = useMemo(() => {
    const sessions = history.length;
    const nums = history
      .map((h) => scoreOf(h.feedback, "overall"))
      .filter((n): n is number => typeof n === "number");
    const avgOverall =
      nums.length > 0 ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10 : null;

    const streak = calcStreak(history);

    // Placeholder WPM – if you later store it in feedback (e.g., feedback.delivery.wpm),
    // just compute from there. For now, show "—" or a derived dummy.
    const lastWpm = "—";

    return { sessions, avgOverall, streak, lastWpm };
  }, [history]);

  // --- Derived: recent 5 items (desc) ---
  const recents = useMemo(() => {
    return [...history]
      .sort(
        (a, b) =>
          (toDate(b.created_at)?.getTime() ?? 0) - (toDate(a.created_at)?.getTime() ?? 0)
      )
      .slice(0, 5);
  }, [history]);

  if (!ready) return null;

  return (
    <Layout>
      {/* Hero / greeting */}
      <section className="relative">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-blue-900/40 via-slate-900 to-black" />
        <div className="mx-auto max-w-7xl px-6 py-10">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 md:p-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div>
                <h1 className="text-3xl md:text-4xl font-extrabold">
                  Welcome back, <span className="text-cyan-400">{displayName}</span> 👋
                </h1>
                <p className="text-slate-300 mt-2">
                  Ready to practice? Jump into a live analysis or generate a new speech.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/analyze"
                  className="rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-5 py-3 font-semibold shadow hover:opacity-90"
                >
                  🎧 Start Live Analyze
                </Link>
                <Link
                  href="/generate"
                  className="rounded-xl border border-slate-700 px-5 py-3 font-semibold hover:border-cyan-500"
                >
                  📝 Generate Speech
                </Link>
                <button
                  onClick={() => window.dispatchEvent(new Event("open-chat"))}
                  className="rounded-xl border border-slate-700 px-5 py-3 font-semibold hover:border-cyan-500"
                  title="Open AI Coach (C)"
                >
                  🤖 Chat with Coach
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Key metrics */}
      <section className="mx-auto max-w-7xl px-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total Sessions"
            value={loadingHistory ? <Skeleton /> : String(stats.sessions ?? "—")}
            hint="from your saved history"
          />
          <StatCard
            label="Avg. Score"
            value={loadingHistory ? <Skeleton /> : fmtNum(stats.avgOverall)}
            hint="overall across sessions"
          />
          <StatCard
            label="WPM (last)"
            value={loadingHistory ? <Skeleton /> : String(stats.lastWpm)}
            hint="last analyzed clip"
          />
          <StatCard
            label="Streak"
            value={loadingHistory ? <Skeleton /> : `${stats.streak}d`}
            hint="consecutive practice days"
          />
        </div>
      </section>

      {/* Main grid: actions + recent activity + onboarding + announcements */}
      <section className="mx-auto max-w-7xl px-6 mt-8 grid gap-6 lg:grid-cols-3">
        {/* Left: actions */}
        <div className="lg:col-span-2 grid gap-6 md:grid-cols-2">
          <ActionCard
            href="/analyze"
            title="Analyze Speech"
            emoji="🔎"
            desc="Record live or upload audio to get AI feedback on tone, pace, and clarity."
          />
          <ActionCard
            href="/generate"
            title="Generate Speech"
            emoji="🧠"
            desc="Create tailored speech scripts. Copy or delete outputs on the fly."
          />
          <ActionCard
            href="/history"
            title="History & Progress"
            emoji="📈"
            desc="Review saved analytics and track improvements over time."
          />
          <ActionCard
            href="/progress"
            title="Progress Charts"
            emoji="📊"
            desc="See your section scores trend over time."
          />
          <ActionCard
            href="/profile"
            title="Profile"
            emoji="👤"
            desc="Manage your details and preferences."
          />
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <h3 className="text-xl font-semibold mb-2">⚡ Quick Tips</h3>
            <ul className="list-disc list-inside text-slate-300 space-y-1">
              <li>Keep recordings 60–90s for faster analysis.</li>
              <li>Practice with deliberate pauses to reduce fillers.</li>
              <li>Shorten long sentences to boost clarity.</li>
            </ul>
          </div>
        </div>

        {/* Right: recent + onboarding + announcements */}
        <div className="grid gap-6">
          {/* Recent Activity */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold">Recent Activity</h3>
              <Link
                href="/history"
                className="text-sm text-cyan-300 hover:text-cyan-200 transition"
              >
                View all →
              </Link>
            </div>

            {loadingHistory ? (
              <div className="mt-4 space-y-3">
                <ListSkeleton />
                <ListSkeleton />
                <ListSkeleton />
              </div>
            ) : historyErr ? (
              <div className="mt-4 rounded-lg border border-red-600 bg-red-600/10 px-4 py-3 text-sm text-red-300">
                {historyErr}
              </div>
            ) : recents.length === 0 ? (
              <p className="mt-3 text-slate-400">No sessions yet — run your first analysis.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {recents.map((it) => {
                  const created = it.created_at
                    ? new Date(it.created_at).toLocaleString()
                    : "—";
                  const overall = scoreOf(it.feedback, "overall");
                  return (
                    <li
                      key={it.id}
                      className="rounded-lg border border-slate-800 hover:border-cyan-500/40 transition p-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-sm">
                          <div className="text-slate-200 font-medium">Session #{it.id}</div>
                          <div className="text-slate-500">{created}</div>
                        </div>
                        <div className="text-xs rounded-full border border-slate-700 px-3 py-1 text-slate-300">
                          Overall: <span className="text-cyan-300"></span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Onboarding / checklist */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <h3 className="text-xl font-semibold mb-3">Get set up</h3>
            <ul className="space-y-3">
              <CheckItem
                done={history.length > 0}
                label="Complete your first analysis"
                href="/analyze"
              />
              <CheckItem
                done={false}
                label="Generate a practice script"
                href="/generate"
              />
              <CheckItem
                done={!!user?.username}
                label="Set your display name"
                href="/profile"
              />
            </ul>
          </div>

          {/* Announcements */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <h3 className="text-xl font-semibold mb-2">Announcements</h3>
            <div className="space-y-3 text-sm">
              <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/80">
                <div className="font-medium text-slate-200">New! Live coaching tips</div>
                <div className="text-slate-400">Open the 🤖 coach from the bottom-right to practice with instant suggestions.</div>
              </div>
              <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/80">
                <div className="font-medium text-slate-200">Improved scoring</div>
                <div className="text-slate-400">Section weighting refined for clearer guidance on delivery and content.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="mx-auto max-w-7xl px-6 py-10 text-sm text-slate-500">
        © {new Date().getFullYear()} OpenSpeak. All rights reserved.
      </footer>

      {/* Keyboard shortcut: C opens chat */}
      <ShortcutOpenChat />
    </Layout>
  );
}

/* ----------------------------- UI helpers ----------------------------- */

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 hover:border-cyan-500/60 transition">
      <div className="text-slate-400 text-sm">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

function ActionCard({
  href,
  title,
  emoji,
  desc,
}: {
  href: string;
  title: string;
  emoji: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-slate-800 bg-slate-900/60 p-6 hover:border-cyan-500 transition shadow"
    >
      <div className="text-3xl mb-2">{emoji}</div>
      <h3 className="text-xl font-semibold mb-1 group-hover:text-cyan-400 transition">
        {title}
      </h3>
      <p className="text-slate-300">{desc}</p>
    </Link>
  );
}

function Skeleton() {
  return <span className="inline-block align-middle h-6 w-16 rounded bg-slate-800 animate-pulse" />;
}

function ListSkeleton() {
  return <div className="h-14 w-full rounded-lg bg-slate-800/60 animate-pulse" />;
}

function CheckItem({ done, label, href }: { done: boolean; label: string; href: string }) {
  return (
    <li className="flex items-center justify-between rounded-lg border border-slate-800 p-3">
      <div className="flex items-center gap-3">
        <span
          className={`h-5 w-5 grid place-items-center rounded-full border ${
            done
              ? "bg-emerald-600/20 border-emerald-600 text-emerald-300"
              : "bg-slate-900/60 border-slate-700 text-slate-400"
          }`}
        >
          {done ? "✓" : "•"}
        </span>
        <span className={done ? "text-slate-400 line-through" : "text-slate-200"}>{label}</span>
      </div>
      <Link
        href={href}
        className="text-sm text-cyan-300 hover:text-cyan-200 transition"
      >
        {done ? "Review" : "Do it"}
      </Link>
    </li>
  );
}

function ShortcutOpenChat() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "c" || e.key === "C") && !e.metaKey && !e.ctrlKey && !e.altKey) {
        window.dispatchEvent(new Event("open-chat"));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return null;
}

function fmtNum(n: number | null | undefined) {
  return typeof n === "number" ? n.toFixed(1) : "—";
}

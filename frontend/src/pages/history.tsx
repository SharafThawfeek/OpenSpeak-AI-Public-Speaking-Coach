// src/pages/history.tsx
import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { api } from "@/utils/api";
import { getToken } from "@/utils/auth";
import Layout from "@/components/Layout";

/* ----------------------------- Types & helpers ---------------------------- */

type Section =
  | { summary?: string; strengths?: string[]; weaknesses?: string[]; score?: number | null; [k: string]: any }
  | string
  | null
  | undefined;

type Feedback = {
  opening?: Section;
  content?: Section;
  delivery?: Section;
  grammar?: Section;
  overall?: Section;
  suggestions?: string[] | null;
  scores?: Partial<Record<"opening" | "content" | "delivery" | "grammar" | "overall", number | null>>;
};

type HistoryItem = {
  id: number;
  transcript?: string;
  created_at?: string;
  feedback?: Feedback;
};

function parseMaybeJSON<T = any>(v: any): T | any {
  if (typeof v === "string") {
    const s = v.trim();
    if ((s.startsWith("{") && s.endsWith("}")) || (s.startsWith("[") && s.endsWith("]"))) {
      try { return JSON.parse(s); } catch { return v; }
    }
  }
  return v;
}

function sectionToText(s: Section): string {
  if (!s) return "—";
  if (typeof s === "string") return s;
  if (typeof s === "object") {
    if (s.summary) return String(s.summary);
    const parts: string[] = [];
    if (Array.isArray(s.strengths) && s.strengths.length) parts.push(`Strengths: ${s.strengths.join("; ")}`);
    if (Array.isArray(s.weaknesses) && s.weaknesses.length) parts.push(`Weaknesses: ${s.weaknesses.join("; ")}`);
    return parts.join("  •  ") || "—";
  }
  return "—";
}

function scoreOf(fb: Feedback | undefined, key: "opening" | "content" | "delivery" | "grammar" | "overall") {
  if (!fb) return null;
  const sec = (fb as any)[key] as Section;
  let inline: number | null | undefined = null;
  if (sec && typeof sec === "object" && "score" in sec) inline = (sec as any).score;
  const fromBlock = fb.scores?.[key];
  return (inline ?? fromBlock) ?? null;
}

function clamp(n: number, a: number, b: number) { return Math.max(a, Math.min(b, n)); }
const fmt = (d?: string) => (d ? new Date(d).toLocaleString() : "");

/* --------------------------------- Page ----------------------------------- */

export default function HistoryPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [items, setItems] = useState<HistoryItem[]>([]);

  // UI state: filters / sort / pagination
  const [query, setQuery] = useState("");
  const [range, setRange] = useState<"7" | "30" | "90" | "all">("all");
  const [minScore, setMinScore] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<"date_desc" | "date_asc" | "score_desc" | "score_asc">("date_desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // auth guard
  useEffect(() => {
    if (!getToken()) router.replace("/login");
    else setReady(true);
  }, [router]);

  // fetch
  useEffect(() => {
    if (!ready) return;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const { data } = await api.get("/history");
        const speeches = Array.isArray(data) ? data : (data?.speeches ?? []);
        const normalized: HistoryItem[] = speeches.map((s: any) => ({
          id: s.id,
          transcript: s.transcript,
          created_at: s.created_at,
          feedback: s.feedback
            ? {
                ...s.feedback,
                opening: parseMaybeJSON(s.feedback.opening),
                content: parseMaybeJSON(s.feedback.content),
                delivery: parseMaybeJSON(s.feedback.delivery),
                grammar: parseMaybeJSON(s.feedback.grammar),
                overall: parseMaybeJSON(s.feedback.overall),
              }
            : undefined,
        }));
        setItems(normalized);
      } catch (e: any) {
        const detail = e?.response?.data?.detail;
        const msg =
          (Array.isArray(detail) && detail.map((d: any) => d?.msg).filter(Boolean).join(" • ")) ||
          (typeof detail === "string" ? detail : null) ||
          e?.message ||
          "Failed to load history.";
        setErr(msg);
      } finally {
        setLoading(false);
      }
    })();
  }, [ready]);

  // derived: filtered + sorted
  const filteredSorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    const cutoff = range === "all" ? 0 : Date.now() - parseInt(range, 10) * 24 * 3600 * 1000;

    let list = items.filter((it) => {
      // range
      const ts = it.created_at ? new Date(it.created_at).getTime() : 0;
      if (range !== "all" && ts < cutoff) return false;

      // minScore (on overall)
      if (typeof minScore === "number") {
        const sc = scoreOf(it.feedback, "overall");
        if (!(typeof sc === "number" && sc >= minScore)) return false;
      }

      // query in transcript or summaries
      if (!q) return true;
      const hay = [
        it.transcript || "",
        sectionToText(it.feedback?.content),
        sectionToText(it.feedback?.overall),
        sectionToText(it.feedback?.delivery),
        sectionToText(it.feedback?.grammar),
        sectionToText(it.feedback?.opening),
        ...(it.feedback?.suggestions ?? []),
      ]
        .join(" ")
        .toLowerCase();

      return hay.includes(q);
    });

    list = list.sort((a, b) => {
      if (sortBy === "date_desc") {
        return (new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
      } else if (sortBy === "date_asc") {
        return (new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
      } else {
        const sa = scoreOf(a.feedback, "overall") ?? -Infinity;
        const sb = scoreOf(b.feedback, "overall") ?? -Infinity;
        return sortBy === "score_desc" ? (sb - sa) : (sa - sb);
      }
    });

    return list;
  }, [items, query, range, minScore, sortBy]);

  // pagination slices
  const total = filteredSorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = clamp(page, 1, totalPages);
  const pageItems = useMemo(
    () => filteredSorted.slice((safePage - 1) * pageSize, safePage * pageSize),
    [filteredSorted, safePage, pageSize]
  );

  // actions
  const copy = (text: string) => {
    navigator.clipboard?.writeText(text);
  };

  const exportCSV = useCallback(() => {
    const rows = [["id","date","opening","content","delivery","grammar","overall","has_transcript"]];
    filteredSorted.forEach(it => {
      const d = it.created_at ? new Date(it.created_at).toISOString() : "";
      rows.push([
        String(it.id),
        d,
        String(scoreOf(it.feedback, "opening") ?? ""),
        String(scoreOf(it.feedback, "content") ?? ""),
        String(scoreOf(it.feedback, "delivery") ?? ""),
        String(scoreOf(it.feedback, "grammar") ?? ""),
        String(scoreOf(it.feedback, "overall") ?? ""),
        it.transcript ? "yes" : "no",
      ]);
    });
    const csv = rows.map(r => r.map(cell => /[",\n]/.test(cell) ? `"${cell.replace(/"/g,'""')}"` : cell).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "openspeak_history.csv"; a.click();
    URL.revokeObjectURL(url);
  }, [filteredSorted]);

  if (!ready) return null;

  return (
    <Layout>
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-extrabold">History & Progress</h1>
          <p className="text-slate-300">Browse your saved sessions, search, filter, and export.</p>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={query}
            onChange={(e) => { setPage(1); setQuery(e.target.value); }}
            placeholder="Search transcript & feedback…"
            className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-cyan-500"
          />

          <div className="flex rounded-lg border border-slate-700 overflow-hidden">
            {(["7","30","90","all"] as const).map(r => (
              <button
                key={r}
                onClick={() => { setPage(1); setRange(r); }}
                className={`px-3 py-2 text-sm ${range===r ? "bg-cyan-500/20 text-cyan-300" : "text-slate-300 hover:bg-slate-800/60"}`}
              >
                {r==="all" ? "All" : `Last ${r}d`}
              </button>
            ))}
          </div>

          <select
            value={sortBy}
            onChange={(e)=> setSortBy(e.target.value as any)}
            className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-cyan-500"
            title="Sort"
          >
            <option value="date_desc">Newest → Oldest</option>
            <option value="date_asc">Oldest → Newest</option>
            <option value="score_desc">Highest score</option>
            <option value="score_asc">Lowest score</option>
          </select>

          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400">Min overall</label>
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              value={minScore ?? ""}
              onChange={(e)=> { setPage(1); setMinScore(e.target.value==="" ? null : parseInt(e.target.value)); }}
              className="w-20 rounded-lg bg-slate-800 border border-slate-700 px-2 py-2 text-sm outline-none focus:border-cyan-500"
            />
          </div>

          <button
            onClick={exportCSV}
            className="rounded-lg border border-slate-700 px-3 py-2 text-sm hover:border-cyan-500 hover:text-cyan-400"
          >
            ⬇️ Export CSV
          </button>

          <Link
            href="/progress"
            className="rounded-lg border border-slate-700 px-3 py-2 text-sm hover:border-cyan-500 hover:text-cyan-400"
          >
            📈 View Charts
          </Link>
        </div>
      </div>

      {/* Status blocks */}
      {loading && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 animate-pulse">
          Loading your sessions…
        </div>
      )}

      {err && (
        <div className="rounded-2xl border border-red-600 bg-red-600/10 p-6 text-red-300">
          {err}
        </div>
      )}

      {!loading && !err && filteredSorted.length === 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-slate-300">
          No sessions match your filters. Try clearing search or changing the date range.
        </div>
      )}

      {/* List */}
      {!loading && !err && filteredSorted.length > 0 && (
        <>
          <div className="space-y-6">
            {pageItems.map((it) => {
              const created = fmt(it.created_at);
              const contentSummary = sectionToText(it.feedback?.content);
              const overallSummary = sectionToText(it.feedback?.overall);
              const scOverall = scoreOf(it.feedback, "overall");
              const chips: Array<{label:string; val:number | null; color:string}> = [
                { label: "Opening", val: scoreOf(it.feedback, "opening"), color: "#60a5fa" },
                { label: "Content", val: scoreOf(it.feedback, "content"), color: "#34d399" },
                { label: "Delivery", val: scoreOf(it.feedback, "delivery"), color: "#f472b6" },
                { label: "Grammar", val: scoreOf(it.feedback, "grammar"), color: "#f59e0b" },
              ];

              return (
                <article
                  key={it.id}
                  className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold">Session #{it.id}</h3>
                      <div className="text-xs text-slate-500">{created}</div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm rounded-full border border-slate-700 px-3 py-1">
                        Overall: <span className="text-cyan-300">{scOverall ?? "—"}</span>
                      </span>

                      <details className="relative">
                        <summary className="cursor-pointer text-sm rounded-lg border border-slate-700 px-3 py-1.5 hover:border-cyan-500 hover:text-cyan-400 transition">
                          Section scores
                        </summary>
                        <div className="absolute right-0 mt-2 w-[260px] rounded-xl border border-slate-800 bg-slate-900/95 p-3 shadow-xl z-10">
                          <div className="grid grid-cols-2 gap-2">
                            {chips.map((c) => (
                              <div key={c.label} className="text-xs rounded-lg border border-slate-700 px-2 py-1">
                                <span className="inline-flex items-center gap-2">
                                  <span className="h-2 w-4 rounded-sm" style={{ background: c.color }} />
                                  {c.label}:
                                </span>{" "}
                                <span className="text-cyan-300">{c.val ?? "—"}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </details>

                      {it.transcript && (
                        <button
                          onClick={() => copy(it.transcript!)}
                          className="text-sm rounded-lg border border-slate-700 px-3 py-1.5 hover:border-cyan-500 hover:text-cyan-400 transition"
                          title="Copy transcript"
                        >
                          Copy transcript
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 grid gap-4 md:grid-cols-2">
                    <div>
                      <div className="text-slate-400 text-sm mb-1">Content</div>
                      <div className="text-slate-200">{contentSummary}</div>
                    </div>
                    <div>
                      <div className="text-slate-400 text-sm mb-1">Overall</div>
                      <div className="text-slate-200">{overallSummary}</div>
                    </div>
                  </div>

                  {Array.isArray(it.feedback?.suggestions) && it.feedback!.suggestions!.length > 0 && (
                    <div className="mt-3 rounded-xl border border-slate-800 bg-slate-900 p-3">
                      <div className="text-slate-400 text-sm mb-1">Suggestions</div>
                      <ul className="list-disc list-inside text-slate-300 space-y-1">
                        {it.feedback!.suggestions!.map((s, i) => <li key={i}>{s}</li>)}
                      </ul>
                    </div>
                  )}

                  {it.transcript && (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-slate-400 hover:text-slate-200">
                        Transcript (toggle)
                      </summary>
                      <pre className="mt-2 whitespace-pre-wrap text-slate-200 text-sm">
                        {it.transcript}
                      </pre>
                    </details>
                  )}
                </article>
              );
            })}
          </div>

          {/* Pagination */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-slate-400">
              Showing <span className="text-slate-200">{(safePage - 1) * pageSize + 1}</span>–<span className="text-slate-200">{Math.min(safePage * pageSize, total)}</span> of <span className="text-slate-200">{total}</span>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={pageSize}
                onChange={(e)=> { setPage(1); setPageSize(parseInt(e.target.value)); }}
                className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-cyan-500"
              >
                {[5,10,20,50].map(n => <option key={n} value={n}>{n} / page</option>)}
              </select>
              <div className="flex rounded-lg border border-slate-700 overflow-hidden">
                <button
                  onClick={()=> setPage(p => clamp(p-1, 1, totalPages))}
                  className="px-3 py-2 text-sm hover:bg-slate-800/60"
                  disabled={safePage===1}
                >
                  ← Prev
                </button>
                <div className="px-3 py-2 text-sm text-slate-400 border-l border-r border-slate-700">
                  {safePage} / {totalPages}
                </div>
                <button
                  onClick={()=> setPage(p => clamp(p+1, 1, totalPages))}
                  className="px-3 py-2 text-sm hover:bg-slate-800/60"
                  disabled={safePage===totalPages}
                >
                  Next →
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </Layout>
  );
}

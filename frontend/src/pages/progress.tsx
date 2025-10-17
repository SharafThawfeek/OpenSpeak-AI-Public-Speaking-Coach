// src/pages/progress.tsx
import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/router";
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

function scoreOf(fb: Feedback | undefined, key: "opening" | "content" | "delivery" | "grammar" | "overall") {
  if (!fb) return null;
  const sec = (fb as any)[key] as Section;
  let inline: number | null | undefined = null;
  if (sec && typeof sec === "object" && "score" in sec) inline = (sec as any).score;
  const fromBlock = fb.scores?.[key];
  return (inline ?? fromBlock) ?? null;
}

function toDate(v?: string) { return v ? new Date(v) : null; }
function fmtNum(n: number | null) { return typeof n === "number" ? n.toFixed(1) : "—"; }
function clamp(n: number, a: number, b: number) { return Math.max(a, Math.min(b, n)); }

/* ------------------------------- Chart bits -------------------------------- */

type Series = { key: string; label: string; color: string; points: { x: number; y: number; t: string; id: number }[] };

function movingAvg(points: {x:number;y:number;t:string;id:number}[], window = 3) {
  if (window <= 1) return points;
  const out: typeof points = [];
  for (let i = 0; i < points.length; i++) {
    const from = Math.max(0, i - (window - 1));
    const win = points.slice(from, i + 1);
    const y = win.reduce((a, p) => a + p.y, 0) / win.length;
    out.push({ ...points[i], y });
  }
  return out;
}

function LineChart({
  series,
  height = 260,
  padding = 36,
  yMin = 0,
  yMax = 100,
  onHover,
}: {
  series: Series[];
  height?: number;
  padding?: number;
  yMin?: number;
  yMax?: number;
  onHover?: (pt: {label:string; x:number;y:number;t:string; color:string; id:number} | null) => void;
}) {
  const all = series.flatMap(s => s.points);
  const h = height;
  const w = 900;

  if (all.length === 0) {
    return (
      <div className="h-[220px] flex items-center justify-center text-slate-500">
        No chart data yet.
      </div>
    );
  }

  const xs = all.map(p => p.x);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const xScale = (x: number) => padding + ((x - minX) / Math.max(1, maxX - minX)) * (w - padding * 2);
  const yScale = (y: number) => h - padding - ((y - yMin) / Math.max(1, yMax - yMin)) * (h - padding * 2);

  const handleMouse = (evt: React.MouseEvent<SVGSVGElement>) => {
    if (!onHover) return;
    const rect = (evt.target as SVGElement).closest("svg")!.getBoundingClientRect();
    const mx = evt.clientX - rect.left;
    const my = evt.clientY - rect.top;

    // find nearest point across visible series
    let best: {label:string;x:number;y:number;t:string;color:string;dist:number; id:number} | null = null;
    for (const s of series) {
      for (const p of s.points) {
        const dx = xScale(p.x) - mx;
        const dy = yScale(p.y) - my;
        const dist = Math.hypot(dx, dy);
        if (!best || dist < best.dist) best = { label: s.label, x: p.x, y: p.y, t: p.t, color: s.color, dist, id: p.id };
      }
    }
    onHover(best ? { label: best.label, x: best.x, y: best.y, t: best.t, color: best.color, id: best.id } : null);
  };

  const handleLeave = () => onHover?.(null);

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="min-w-[680px] w-full"
        style={{ height: h }}
        onMouseMove={handleMouse}
        onMouseLeave={handleLeave}
      >
        {/* axes */}
        <line x1={padding} y1={h - padding} x2={w - padding} y2={h - padding} stroke="#334155" strokeWidth={1} />
        <line x1={padding} y1={padding} x2={padding} y2={h - padding} stroke="#334155" strokeWidth={1} />
        {[0,20,40,60,80,100].map(v => (
          <g key={v}>
            <line
              x1={padding}
              y1={yScale(v)}
              x2={w - padding}
              y2={yScale(v)}
              stroke="#334155"
              strokeDasharray="4 6"
              strokeWidth={0.5}
            />
            <text x={8} y={yScale(v) + 4} fontSize="10" fill="#94a3b8">{v}</text>
          </g>
        ))}
        {/* x labels first / last */}
        <text x={padding} y={h - 8} fontSize="10" fill="#94a3b8">
          {new Date(all.find(p => p.x === minX)!.t).toLocaleDateString()}
        </text>
        <text x={w - padding - 60} y={h - 8} fontSize="10" fill="#94a3b8" textAnchor="end">
          {new Date(all.find(p => p.x === maxX)!.t).toLocaleDateString()}
        </text>

        {/* lines + dots */}
        {series.map((s, i) => {
          const d = s.points
            .sort((a, b) => a.x - b.x)
            .map((p, idx) => `${idx === 0 ? "M" : "L"} ${xScale(p.x)} ${yScale(p.y)}`)
            .join(" ");
          return (
            <g key={i}>
              <path d={d} fill="none" stroke={s.color} strokeWidth={2} />
              {s.points.map((p, j) => (
                <circle key={j} cx={xScale(p.x)} cy={yScale(p.y)} r={3} fill={s.color} />
              ))}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* --------------------------------- Page ----------------------------------- */

export default function ProgressPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [items, setItems] = useState<HistoryItem[]>([]);

  // controls
  const [range, setRange] = useState<"7" | "30" | "90" | "all">("30");
  const [smooth, setSmooth] = useState<boolean>(true);
  const [visible, setVisible] = useState<Record<string, boolean>>({
    overall: true,
    opening: true,
    content: true,
    delivery: true,
    grammar: true,
  });

  // hover tooltip
  const [hover, setHover] = useState<{ label: string; x: number; y: number; t: string; color: string; id: number } | null>(null);

  // auth guard
  useEffect(() => {
    if (!getToken()) router.replace("/login");
    else setReady(true);
  }, [router]);

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
          "Failed to load progress.";
        setErr(msg);
      } finally {
        setLoading(false);
      }
    })();
  }, [ready]);

  // sort asc (for chart)
  const sorted = useMemo(() => {
    return [...items].sort((a, b) => {
      const da = (a.created_at ? new Date(a.created_at).getTime() : 0);
      const db = (b.created_at ? new Date(b.created_at).getTime() : 0);
      return da - db;
    });
  }, [items]);

  // filter by time range
  const filtered = useMemo(() => {
    if (range === "all") return sorted;
    const days = parseInt(range, 10);
    const cutoff = Date.now() - days * 24 * 3600 * 1000;
    return sorted.filter(it => (it.created_at ? new Date(it.created_at).getTime() >= cutoff : false));
  }, [sorted, range]);

  // computed stats
  const totals = useMemo(() => {
    const base = filtered.length ? filtered : sorted; // if range filters all out, fallback to total
    const n = base.length || 0;
    const getAvg = (key: "opening" | "content" | "delivery" | "grammar" | "overall") => {
      if (!n) return null;
      const nums = base
        .map(it => scoreOf(it.feedback, key))
        .filter((v): v is number => typeof v === "number");
      if (!nums.length) return null;
      return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
    };
    // streak uses entire history (practice consistency)
    const streak = (() => {
      if (sorted.length === 0) return 0;
      const days = Array.from(new Set(sorted.map(it => {
        const d = it.created_at ? new Date(it.created_at) : null;
        if (!d) return null;
        return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      }).filter(Boolean) as number[])).sort((a, b) => a - b);
      if (days.length === 0) return 0;
      let s = 0;
      let cursor = new Date();
      cursor.setHours(0,0,0,0);
      for (;;) {
        const ts = cursor.getTime();
        if (days.includes(ts)) { s += 1; cursor = new Date(ts - 24*3600*1000); }
        else break;
      }
      return s;
    })();

    return {
      sessions: base.length,
      avgOverall: getAvg("overall"),
      avgContent: getAvg("content"),
      avgDelivery: getAvg("delivery"),
      avgGrammar: getAvg("grammar"),
      avgOpening: getAvg("opening"),
      streak,
    };
  }, [filtered, sorted]);

  // insights
  const insights = useMemo(() => {
    if (!sorted.length) return null;

    // Most improved section (compare first half vs second half)
    const half = Math.floor(sorted.length / 2);
    const keys: Array<"opening" | "content" | "delivery" | "grammar" | "overall"> = ["opening","content","delivery","grammar","overall"];
    const deltas = keys.map(k => {
      const first = sorted.slice(0, half).map(h => scoreOf(h.feedback, k)).filter((n):n is number=>typeof n==="number");
      const second = sorted.slice(half).map(h => scoreOf(h.feedback, k)).filter((n):n is number=>typeof n==="number");
      const avg = (arr:number[]) => arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : NaN;
      return { key: k, delta: (avg(second) - avg(first)) || 0 };
    }).sort((a,b)=> (b.delta||0)-(a.delta||0));
    const mostImproved = deltas[0];

    // Best session day by overall
    const scored = sorted
      .map(h => ({ h, overall: scoreOf(h.feedback, "overall") }))
      .filter((s): s is {h:HistoryItem; overall:number} => typeof s.overall === "number")
      .sort((a,b)=> (b.overall - a.overall));
    const best = scored[0];

    // Suggestions top words (very light extraction)
    const suggestions = sorted.flatMap(h => (h.feedback?.suggestions ?? [])).filter(Boolean);
    const topHint = (() => {
      if (!suggestions.length) return null;
      const text = suggestions.join(" ").toLowerCase();
      const keys2 = ["pauses", "pace", "clarity", "fillers", "volume", "structure", "eye", "confidence"];
      const hit = keys2.find(k => text.includes(k));
      return hit ? `Focus on ${hit}.` : null;
    })();

    return {
      mostImproved,
      best,
      topHint,
    };
  }, [sorted]);

  // export CSV
  const exportCsv = useCallback(() => {
    const rows = [["id","date","opening","content","delivery","grammar","overall"]];
    sorted.forEach(it => {
      const d = it.created_at ? new Date(it.created_at) : null;
      const r = [
        it.id,
        d ? d.toISOString() : "",
        scoreOf(it.feedback,"opening") ?? "",
        scoreOf(it.feedback,"content") ?? "",
        scoreOf(it.feedback,"delivery") ?? "",
        scoreOf(it.feedback,"grammar") ?? "",
        scoreOf(it.feedback,"overall") ?? "",
      ];
      rows.push(r.map(c => String(c)));
    });
    const csv = rows.map(r => r.map(cell => /[",\n]/.test(cell) ? `"${cell.replace(/"/g,'""')}"` : cell).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "openspeak_progress.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, [sorted]);

  // chart data (respect range + smoothing + visibility)
  const basePoints = useMemo(() => {
    const base = filtered;
    const mk = (label: string, key: "opening" | "content" | "delivery" | "grammar" | "overall", color: string): Series => {
      const pts = base
        .map((it) => {
          const d = it.created_at ? new Date(it.created_at) : null;
          const y = scoreOf(it.feedback, key);
          if (!d || typeof y !== "number") return null;
          return { x: d.getTime(), y, t: d.toISOString(), id: it.id };
        })
        .filter(Boolean) as { x: number; y: number; t: string; id:number }[];
      const sortedPts = pts.sort((a, b) => a.x - b.x);
      return {
        key,
        label,
        color,
        points: smooth ? movingAvg(sortedPts, 3) : sortedPts,
      };
    };
    const all = [
      mk("Overall", "overall", "#22d3ee"),
      mk("Opening", "opening", "#60a5fa"),
      mk("Content", "content", "#34d399"),
      mk("Delivery", "delivery", "#f472b6"),
      mk("Grammar", "grammar", "#f59e0b"),
    ];
    return all.filter(s => visible[s.key] !== false);
  }, [filtered, smooth, visible]);

  if (!ready) return null;

  return (
    <Layout>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold mb-1">Your Progress</h1>
          <p className="text-slate-300">
            Track your scores over time. Data comes from your saved analyses.
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setSmooth(s => !s)}
            className={`rounded-lg border px-3 py-1.5 text-sm ${smooth ? "border-emerald-600 text-emerald-300" : "border-slate-700 text-slate-300"} hover:border-cyan-500`}
            title="Moving average (3)"
          >
            {smooth ? "Smoothing: On" : "Smoothing: Off"}
          </button>
          <div className="flex rounded-lg border border-slate-700 overflow-hidden">
            {(["7","30","90","all"] as const).map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1.5 text-sm ${range===r ? "bg-cyan-500/20 text-cyan-300" : "text-slate-300 hover:bg-slate-800/60"}`}
              >
                {r === "all" ? "All" : `Last ${r}d`}
              </button>
            ))}
          </div>
          <button
            onClick={exportCsv}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm hover:border-cyan-500 hover:text-cyan-400"
          >
            ⬇️ Export CSV
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 my-6">
        <Stat label="Sessions" value={String(totals.sessions)} />
        <Stat label="Avg Overall" value={fmtNum(totals.avgOverall)} />
        <Stat label="Avg Content" value={fmtNum(totals.avgContent)} />
        <Stat label="Avg Delivery" value={fmtNum(totals.avgDelivery)} />
        <Stat label="Streak" value={`${totals.streak}d`} />
      </div>

      {/* Insights */}
      <section className="grid gap-4 md:grid-cols-3 mb-6">
        <Insight
          title="Most improved"
          value={
            insights?.mostImproved
              ? `${capitalize(insights.mostImproved.key)} (${(insights.mostImproved.delta>0?"+":"")}${(insights.mostImproved.delta||0).toFixed(1)})`
              : "—"
          }
          hint="Change vs earlier sessions"
        />
        <Insight
          title="Best session"
          value={insights?.best ? `#${insights.best.h.id} • ${insights.best.overall.toFixed(1)}` : "—"}
          hint={insights?.best?.h?.created_at ? new Date(insights.best.h.created_at).toLocaleString() : ""}
        />
        <Insight
          title="Coach tip"
          value={insights?.topHint ?? "Practice consistently for faster gains."}
          hint="Derived from your suggestions"
        />
      </section>

      {/* Chart Card */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 mb-6 relative">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="text-xl font-semibold">Scores over time</h2>
          <Legend
            items={[
              { key: "overall", label: "Overall", color: "#22d3ee" },
              { key: "opening", label: "Opening", color: "#60a5fa" },
              { key: "content", label: "Content", color: "#34d399" },
              { key: "delivery", label: "Delivery", color: "#f472b6" },
              { key: "grammar", label: "Grammar", color: "#f59e0b" },
            ]}
            visible={visible}
            onToggle={(k) => setVisible(v => ({ ...v, [k]: !v[k] }))}
          />
        </div>

        <LineChart
          series={basePoints}
          onHover={setHover}
        />

        {/* Tooltip */}
        {hover && (
          <div
            className="pointer-events-none absolute -translate-x-1/2 rounded-lg border border-slate-700 bg-slate-900/90 px-3 py-2 text-xs shadow"
            style={{
              left: `${clamp( ( (() => {
                // find hovered x position in px within chart container width
                const all = basePoints.flatMap(s=>s.points);
                const minX = Math.min(...all.map(p=>p.x));
                const maxX = Math.max(...all.map(p=>p.x));
                const w = 900, pad=36;
                const xScale = (x:number)=> pad + ((x - minX)/Math.max(1,maxX-minX))*(w-pad*2);
                return xScale(hover.x);
              })()), 0, 900)}px`,
              top: "8px",
              borderColor: hover.color
            }}
          >
            <div className="font-semibold" style={{ color: hover.color }}>{hover.label}</div>
            <div>{new Date(hover.t).toLocaleString()}</div>
            <div>Score: <span className="text-cyan-300">{hover.y.toFixed(1)}</span></div>
            <div className="opacity-70">Session #{hover.id}</div>
          </div>
        )}
      </section>

      {loading && (
        <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 animate-pulse">
          Loading progress…
        </div>
      )}

      {err && (
        <div className="mt-6 rounded-2xl border border-red-600 bg-red-600/10 p-6 text-red-300">
          {err}
        </div>
      )}

      {!loading && !err && (sorted.length === 0) && (
        <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-slate-300">
          No data yet — run an analysis to see your progress here.
        </div>
      )}
    </Layout>
  );
}

/* --------------------------- Tiny UI helpers --------------------------- */

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="text-slate-400 text-sm">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}

function Legend({
  items,
  visible,
  onToggle,
}: {
  items: { key: string; label: string; color: string }[];
  visible: Record<string, boolean>;
  onToggle: (key: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-3 text-sm text-slate-300">
      {items.map((it) => {
        const isOn = visible[it.key] !== false;
        return (
          <button
            key={it.key}
            onClick={() => onToggle(it.key)}
            className={`inline-flex items-center gap-2 rounded-md border px-2 py-1 ${
              isOn ? "border-slate-700 hover:border-cyan-500" : "border-slate-800 opacity-50 hover:opacity-80"
            }`}
            title={isOn ? "Hide" : "Show"}
          >
            <span className="h-2 w-4 rounded-sm" style={{ background: it.color }} />
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

function Insight({ title, value, hint }: { title: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="text-slate-400 text-sm">{title}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
      {hint && <div className="text-xs text-slate-500 mt-1">{hint}</div>}
    </div>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

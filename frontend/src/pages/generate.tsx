// src/pages/generate.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { api } from "@/utils/api";
import { getToken } from "@/utils/auth";
import Layout from "@/components/Layout";

type Tone =
  | "Inspirational"
  | "Professional"
  | "Casual"
  | "Persuasive"
  | "Empathetic"
  | "Celebratory";

type Length =
  | "1 min"
  | "2–3 min"
  | "5 min"
  | "8–10 min";

type GenItem = {
  id: string;
  prompt: string;
  text: string;
  createdAt: number;
  tone?: Tone;
  length?: Length;
  title?: string;
  liked?: boolean;
};

const LS_KEY = "openspeak_generated_speeches";
const LS_DRAFT = "openspeak_generate_draft";
const LS_SESSION = "openspeak_session_id";

// ---------- helpers ----------
const prettyDate = (ms: number) => new Date(ms).toLocaleString();
const words = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);
const readingTime = (s: string) => {
  const w = words(s);
  const mins = Math.max(1, Math.round(w / 130)); // ~130wpm spoken pace
  return `${mins} min read`;
};
const kebab = (s: string) =>
  s.toLowerCase().replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 64);

export default function GeneratePage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  // ---- input + UI state
  const [input, setInput] = useState("");
  const [tone, setTone] = useState<Tone>("Professional");
  const [length, setLength] = useState<Length>("2–3 min");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---- local-only generated list
  const [items, setItems] = useState<GenItem[]>([]);

  // stable session id (kept in localStorage)
  const sessionIdRef = useRef<string>("");
  const endRef = useRef<HTMLDivElement | null>(null);

  // templates (quick starters)
  const templates: { label: string; prompt: string }[] = [
    {
      label: "Motivate team",
      prompt:
        "Write a motivational speech for a product team about shipping with ownership and customer obsession.",
    },
    {
      label: "Wedding toast",
      prompt:
        "Craft a heartfelt, humorous wedding toast for my best friend that balances warmth and fun.",
    },
    {
      label: "Keynote intro",
      prompt:
        "Create an opening keynote for a developer conference about the future of AI and responsible innovation.",
    },
    {
      label: "Graduation talk",
      prompt:
        "Write a graduation speech that encourages resilience and celebrates small wins.",
    },
  ];

  // ---- mount: auth, session, local items, draft
  useEffect(() => {
    const t = getToken();
    if (!t) {
      router.replace("/login");
      return;
    }
    setReady(true);

    let sid = localStorage.getItem(LS_SESSION);
    if (!sid) {
      sid = crypto.randomUUID();
      localStorage.setItem(LS_SESSION, sid);
    }
    sessionIdRef.current = sid;

    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {}
    try {
      const draft = localStorage.getItem(LS_DRAFT);
      if (draft) setInput(draft);
    } catch {}
  }, [router]);

  // autosave draft
  useEffect(() => {
    const id = setTimeout(() => localStorage.setItem(LS_DRAFT, input), 300);
    return () => clearTimeout(id);
  }, [input]);

  const persist = (next: GenItem[]) => {
    setItems(next);
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(next));
    } catch {}
  };

  const canSubmit = useMemo(() => input.trim().length >= 6, [input]);

  // Convert tone/length to lightweight instruction that nudges the backend
  const buildPrompt = () => {
    const toneLine = `Tone: ${tone}.`;
    const lenLine = `Target length: ${length}.`;
    const guide =
      "Structure with a crisp opening, 2–3 clear points, and a memorable closing. Avoid clichés. Prefer vivid, concrete language.";
    return `${input.trim()}

${toneLine}
${lenLine}
${guide}`;
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || loading) return;

    setLoading(true);
    setError(null);

    try {
      const payload = {
        input: buildPrompt(),
        session_id: sessionIdRef.current,
      };
      const { data } = await api.post("/generate-speech", payload);
      const text: string = data?.answer || "";
      if (!text) throw new Error("No speech returned.");

      const item: GenItem = {
        id: crypto.randomUUID(),
        prompt: input.trim(),
        text,
        createdAt: Date.now(),
        tone,
        length,
        title: input.trim().slice(0, 80),
      };

      const next = [...items, item];
      persist(next);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 0);
      // keep input for iterative generation; clear if you prefer:
      // setInput("");
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || "Failed to generate.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const refineWith = async (id: string, instruction: string) => {
    const it = items.find((x) => x.id === id);
    if (!it || loading) return;
    setLoading(true);
    setError(null);
    try {
      const payload = {
        input: `${it.text}\n\nRevise with this instruction: ${instruction}`,
        session_id: sessionIdRef.current,
      };
      const { data } = await api.post("/generate-speech", payload);
      const text: string = data?.answer || "";
      if (!text) throw new Error("No revision returned.");
      const updated: GenItem = { ...it, text };
      persist(items.map((x) => (x.id === id ? updated : x)));
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || "Refine failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // subtle UX
      // eslint-disable-next-line no-alert
      alert("Copied to clipboard");
    } catch {
      alert("Copy failed");
    }
  };

  const handleDownload = (item: GenItem) => {
    const name = kebab(item.title || item.prompt || "speech");
    const blob = new Blob([item.text], { type: "text/plain;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = (id: string) => {
    persist(items.filter((x) => x.id !== id));
  };

  const toggleLike = (id: string) => {
    persist(items.map((x) => (x.id === id ? { ...x, liked: !x.liked } : x)));
  };

  const clearAll = () => {
    if (confirm("Clear all locally saved speeches?")) persist([]);
  };

  if (!ready) return null;

  return (
    <Layout>
      <main className="mx-auto max-w-6xl px-6 py-8">
        {/* Studio panel */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-2xl font-bold">Create a speech</h2>
            <div className="text-xs text-slate-500 hidden md:block">
              Tip: Be specific about audience, outcome, and constraints.
            </div>
          </div>

          {/* Quick templates */}
          <div className="flex flex-wrap gap-2 mb-4">
            {templates.map((t) => (
              <button
                key={t.label}
                type="button"
                onClick={() => setInput(t.prompt)}
                className="text-xs rounded-full border border-slate-700 px-3 py-1 hover:border-cyan-500 hover:text-cyan-400 transition"
                title="Use template"
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Controls row */}
          <div className="grid gap-3 md:grid-cols-2 mb-3">
            {/* tone */}
            <div>
              <label className="block text-sm text-slate-300 mb-1">Tone</label>
              <div className="flex flex-wrap gap-2">
                {(["Professional","Inspirational","Casual","Persuasive","Empathetic","Celebratory"] as Tone[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTone(t)}
                    className={`rounded-full px-3 py-1 text-sm border ${
                      tone === t
                        ? "border-cyan-500 text-cyan-300"
                        : "border-slate-700 text-slate-300 hover:border-slate-600"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* length */}
            <div>
              <label className="block text-sm text-slate-300 mb-1">Target length</label>
              <div className="flex flex-wrap gap-2">
                {(["1 min","2–3 min","5 min","8–10 min"] as Length[]).map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLength(l)}
                    className={`rounded-full px-3 py-1 text-sm border ${
                      length === l
                        ? "border-cyan-500 text-cyan-300"
                        : "border-slate-700 text-slate-300 hover:border-slate-600"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-600 bg-red-600/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <form onSubmit={handleGenerate} className="space-y-3">
            <label className="block text-sm text-slate-300">Prompt *</label>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={5}
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-4 py-3 outline-none focus:border-cyan-500"
              placeholder={`e.g., “Write a 3-minute inspirational talk for new hires about ownership and bias for action.”`}
            />
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={!canSubmit || loading}
                  className="rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-5 py-3 font-semibold shadow hover:opacity-90 disabled:opacity-60"
                >
                  {loading ? "Generating…" : "Generate Speech"}
                </button>
                <button
                  type="button"
                  disabled={loading || !input.trim()}
                  onClick={() => setInput("")}
                  className="rounded-lg border border-slate-700 px-3 py-2 text-sm hover:border-slate-600 disabled:opacity-60"
                >
                  Clear
                </button>
              </div>
              <div className="text-xs text-slate-500">
                {input.trim().length} chars • {words(input)} words
              </div>
            </div>
          </form>
        </div>

        {/* local history */}
        <section className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xl font-semibold">Your generated speeches</h3>
            <div className="flex items-center gap-2">
              {items.length > 0 && (
                <button
                  onClick={() => {
                    const all = items
                      .map((it) => `# ${it.title || it.prompt}\n(${prettyDate(it.createdAt)})\n\n${it.text}\n`)
                      .join("\n— — — — —\n\n");
                    const blob = new Blob([all], { type: "text/plain;charset=utf-8;" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "openspeak_speeches.txt";
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="text-sm rounded-lg border border-slate-700 px-3 py-1.5 hover:border-cyan-500 hover:text-cyan-400 transition"
                >
                  ⬇️ Export all
                </button>
              )}
              {items.length > 0 && (
                <button
                  onClick={clearAll}
                  className="text-sm rounded-lg border border-slate-700 px-3 py-1.5 hover:border-red-500 hover:text-red-400 transition"
                >
                  Clear all
                </button>
              )}
            </div>
          </div>

          {items.length === 0 ? (
            <p className="text-slate-400">No speeches yet — generate your first one above.</p>
          ) : (
            <div className="space-y-6">
              {items.map((it) => (
                <article
                  key={it.id}
                  className="w-full rounded-2xl border border-slate-800 bg-slate-900/60 p-5"
                >
                  {/* header */}
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                    <div className="min-w-0">
                      <input
                        value={it.title || ""}
                        onChange={(e) =>
                          persist(items.map((x) => (x.id === it.id ? { ...x, title: e.target.value } : x)))
                        }
                        placeholder="Add a title…"
                        className="w-full text-lg font-semibold bg-transparent outline-none border-b border-transparent focus:border-slate-700 pb-0.5"
                      />
                      <div className="text-xs text-slate-500 mt-0.5">
                        {prettyDate(it.createdAt)} • {readingTime(it.text)} • {words(it.text)} words
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-400">
                        {it.tone && <span className="rounded-full border border-slate-700 px-2 py-0.5">Tone: {it.tone}</span>}
                        {it.length && <span className="rounded-full border border-slate-700 px-2 py-0.5">Length: {it.length}</span>}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 shrink-0">
                      <button
                        onClick={() => toggleLike(it.id)}
                        className={`text-sm rounded-lg border px-3 py-1.5 transition ${
                          it.liked ? "border-emerald-600 text-emerald-300" : "border-slate-700 hover:border-slate-600"
                        }`}
                        title="Favorite"
                      >
                        {it.liked ? "★ Favorited" : "☆ Favorite"}
                      </button>
                      <button
                        onClick={() => handleCopy(it.text)}
                        className="text-sm rounded-lg border border-slate-700 px-3 py-1.5 hover:border-cyan-500 hover:text-cyan-400 transition"
                      >
                        Copy
                      </button>
                      <button
                        onClick={() => handleDownload(it)}
                        className="text-sm rounded-lg border border-slate-700 px-3 py-1.5 hover:border-cyan-500 hover:text-cyan-400 transition"
                      >
                        Download
                      </button>
                      <button
                        onClick={() => handleDelete(it.id)}
                        className="text-sm rounded-lg border border-slate-700 px-3 py-1.5 hover:border-red-500 hover:text-red-400 transition"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* content */}
                  <pre className="mt-3 whitespace-pre-wrap text-slate-200 text-sm leading-6">
                    {it.text}
                  </pre>

                  {/* quick refine actions */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      onClick={() => refineWith(it.id, "Shorten to be more concise while preserving the central message.")}
                      className="text-xs rounded-lg border border-slate-700 px-3 py-1.5 hover:border-cyan-500 hover:text-cyan-400 transition"
                    >
                      ✂️ Shorten
                    </button>
                    <button
                      onClick={() => refineWith(it.id, "Increase vivid imagery and specificity; replace clichés with concrete examples.")}
                      className="text-xs rounded-lg border border-slate-700 px-3 py-1.5 hover:border-cyan-500 hover:text-cyan-400 transition"
                    >
                      🎨 Make vivid
                    </button>
                    <button
                      onClick={() => refineWith(it.id, "Make it more persuasive with a clear call-to-action and stronger logical flow.")}
                      className="text-xs rounded-lg border border-slate-700 px-3 py-1.5 hover:border-cyan-500 hover:text-cyan-400 transition"
                    >
                      💡 More persuasive
                    </button>
                    <button
                      onClick={() => refineWith(it.id, "Adjust tone to be more empathetic and supportive without losing clarity.")}
                      className="text-xs rounded-lg border border-slate-700 px-3 py-1.5 hover:border-cyan-500 hover:text-cyan-400 transition"
                    >
                      🤝 More empathetic
                    </button>
                  </div>
                </article>
              ))}
              {/* scroll target for newly appended item */}
              <div ref={endRef} />
            </div>
          )}
        </section>
      </main>
    </Layout>
  );
}

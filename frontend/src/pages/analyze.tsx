// src/pages/analyze.tsx
import { useEffect, useRef, useState, useMemo } from "react";
import { useRouter } from "next/router";
import { api } from "@/utils/api";
import { getToken } from "@/utils/auth";

/** ---------------- Types exactly as backend returns ---------------- */
type Section =
  | { summary?: string; strengths?: string[]; weaknesses?: string[]; score?: number | null; [k: string]: any }
  | string
  | null
  | undefined;

type BackendFeedback = {
  opening?: Section;
  content?: Section;
  delivery?: Section;
  grammar?: Section;
  overall?: Section;
  suggestions?: string[] | null;
  scores?: Partial<Record<"opening" | "content" | "delivery" | "grammar" | "overall", number | null>>;
};

type AnalyzeAudioResponse = {
  speech_id: number;
  transcript: string;
  feedback: BackendFeedback;
};

type AnalyzeTextResponse = {
  speech_id: number;
  feedback: BackendFeedback;
};

/** ---------------- Small utilities ---------------- */
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
  if (!s) return "No feedback provided.";
  if (typeof s === "string") return s;
  if (typeof s === "object") {
    if (s.summary) return String(s.summary);
    const parts: string[] = [];
    if (Array.isArray(s.strengths) && s.strengths.length) parts.push(`Strengths: ${s.strengths.join("; ")}`);
    if (Array.isArray(s.weaknesses) && s.weaknesses.length) parts.push(`Weaknesses: ${s.weaknesses.join("; ")}`);
    return parts.join("  •  ") || "No feedback provided.";
  }
  return "No feedback provided.";
}

function asErrorMessage(e: any): string {
  const detail = e?.response?.data?.detail;
  if (Array.isArray(detail)) {
    const msgs = detail.map((d: any) => d?.msg ?? JSON.stringify(d)).filter(Boolean);
    if (msgs.length) return msgs.join(" • ");
  }
  if (typeof detail === "string") return detail;
  if (detail && typeof detail === "object" && "msg" in detail) return String(detail.msg);
  if (e?.message) return String(e.message);
  return "Analysis failed.";
}

/** ---------------- The page ---------------- */
export default function AnalyzePage() {
  const router = useRouter();

  // Auth guard
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!getToken()) router.replace("/login");
    else setReady(true);
  }, [router]);

  // Mode & inputs
  const [mode, setMode] = useState<"record" | "upload" | "text">("record");
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");

  // Recording
  const [recording, setRecording] = useState(false);
  const [recordMs, setRecordMs] = useState(0);
  const [level, setLevel] = useState(0); // 0..1 mic meter

  // Auto-stop control: null = no limit, number = seconds
  const [maxSecs, setMaxSecs] = useState<number | null>(120);
  const [limitMode, setLimitMode] = useState<
    "none" | "60" | "90" | "120" | "180" | "300" | "600" | "900" | "1200" | "custom"
  >("120");
  const [customMinutes, setCustomMinutes] = useState<number>(20);

  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);

  // Mic meter (WebAudio)
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const meterRAF = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Audio preview
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Results
  const [speechId, setSpeechId] = useState<number | null>(null);
  const [transcript, setTranscript] = useState<string>("");
  const [feedback, setFeedback] = useState<BackendFeedback | null>(null);

  // UX
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Clean object URL on file change
  useEffect(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (file) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPreviewUrl(null);
    }
  }, [file]);

  // React to limit mode changes
  useEffect(() => {
    if (limitMode === "none") {
      setMaxSecs(null);
    } else if (limitMode === "custom") {
      const mins = Math.max(1, Math.min(120, Math.floor(customMinutes || 1)));
      setMaxSecs(mins * 60);
    } else {
      setMaxSecs(Number(limitMode));
    }
  }, [limitMode, customMinutes]);

  /** -------- Recording controls -------- */
  const stopMeter = () => {
    if (meterRAF.current) {
      cancelAnimationFrame(meterRAF.current);
      meterRAF.current = null;
    }
    setLevel(0);
  };

  const startMeter = (stream: MediaStream) => {
    try {
      const Ctx: any = (window as any).AudioContext || (window as any).webkitAudioContext;
      const ctx = new Ctx();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const data = new Uint8Array(analyser.frequencyBinCount);
      const loop = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        setLevel(Math.min(1, rms * 2)); // scale a bit
        meterRAF.current = requestAnimationFrame(loop);
      };
      loop();
    } catch {
      // ignore meter errors (recording still works)
    }
  };

  const startRecording = async () => {
    setErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mime =
        MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];

      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        stopMeter();

        const blob = new Blob(chunksRef.current, { type: mime });
        const f = new File([blob], `recording_${Date.now()}.webm`, { type: mime });
        setFile(f);
      };

      rec.start(100);
      mediaRef.current = rec;
      setRecording(true);
      setRecordMs(0);
      timerRef.current = window.setInterval(() => {
        setRecordMs((ms) => {
          const next = ms + 200;
          // Only auto-stop if a limit is set
          if (maxSecs != null && next >= maxSecs * 1000) {
            stopRecording();
          }
          return next;
        });
      }, 200);

      // start mic meter
      startMeter(stream);
    } catch (e) {
      setErr(asErrorMessage(e));
    }
  };

  const stopRecording = () => {
    if (mediaRef.current && mediaRef.current.state !== "inactive") mediaRef.current.stop();
    setRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    // stop meter + ctx
    stopMeter();
    try {
      audioCtxRef.current?.close();
    } catch {}
    audioCtxRef.current = null;
    analyserRef.current = null;
    // stop tracks if any
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  /** -------- Backend calls (match your routes) -------- */
  async function callAnalyzeAudio(f: File) {
    const form = new FormData();
    form.append("file", f, f.name);
    const { data } = await api.post<AnalyzeAudioResponse>("/analyze_audio", form);
    return data;
  }

  async function callAnalyzeText(t: string) {
    const { data } = await api.post<AnalyzeTextResponse>("/analyze", { transcript: t });
    return data;
  }

  /** -------- Submit flows -------- */
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    setSpeechId(null);
    setTranscript("");
    setFeedback(null);

    try {
      if (mode === "record" || mode === "upload") {
        if (!file) throw new Error("Please record or choose an audio file.");
        const res = await callAnalyzeAudio(file);
        const fb: BackendFeedback = {
          ...res.feedback,
          opening: parseMaybeJSON(res.feedback?.opening),
          content: parseMaybeJSON(res.feedback?.content),
          delivery: parseMaybeJSON(res.feedback?.delivery),
          grammar: parseMaybeJSON(res.feedback?.grammar),
          overall: parseMaybeJSON(res.feedback?.overall),
        };
        setSpeechId(res.speech_id);
        setTranscript(res.transcript || "");
        setFeedback(fb);
      } else {
        if (!text.trim()) throw new Error("Please paste or type a transcript.");
        const res = await callAnalyzeText(text.trim());
        const fb: BackendFeedback = {
          ...res.feedback,
          opening: parseMaybeJSON(res.feedback?.opening),
          content: parseMaybeJSON(res.feedback?.content),
          delivery: parseMaybeJSON(res.feedback?.delivery),
          grammar: parseMaybeJSON(res.feedback?.grammar),
          overall: parseMaybeJSON(res.feedback?.overall),
        };
        setSpeechId(res.speech_id);
        setTranscript(text.trim());
        setFeedback(fb);
      }
    } catch (e) {
      setErr(asErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  /** -------- Score resolver -------- */
  const getScore = (key: "opening" | "content" | "delivery" | "grammar" | "overall"): number | null => {
    if (!feedback) return null;
    const sec = (feedback as any)[key] as Section;
    let inline: number | null | undefined = null;
    if (sec && typeof sec === "object" && "score" in sec) inline = (sec as any).score;
    const fromBlock = feedback.scores?.[key];
    return (inline ?? fromBlock) ?? null;
  };

  /** -------- UI helpers -------- */
  const ScoreChip = ({ label, value }: { label: string; value: number | null }) => (
    <div className="text-sm rounded-full border border-slate-700 px-3 py-1 text-slate-300">
      {label}: <span className="text-cyan-300">{value ?? "—"}</span>
    </div>
  );

  const Card = ({
    title,
    score,
    children,
  }: {
    title: string;
    score: number | null;
    children: React.ReactNode;
  }) => (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xl font-semibold">{title}</h3>
        <ScoreChip label="Score" value={score} />
      </div>
      <div className="text-slate-200 whitespace-pre-wrap">{children}</div>
    </div>
  );

  const timeStr = useMemo(() => {
    const s = Math.floor(recordMs / 1000);
    const mm = String(Math.floor(s / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    if (maxSecs == null) return `${mm}:${ss}`;
    const M = Math.floor(maxSecs / 60);
    const S = maxSecs % 60;
    return `${mm}:${ss} / ${String(M).padStart(2, "0")}:${String(S).padStart(2, "0")}`;
  }, [recordMs, maxSecs]);

  if (!ready) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex items-center justify-between gap-3 mb-2">
          <h1 className="text-3xl font-extrabold">Analyze Speech</h1>
          <div className="text-xs text-slate-500 hidden md:block">
            Best results: 60–120s, clear mic, quiet room.
          </div>
        </div>

        {/* Input Panel */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 mb-8">
          {/* Mode toggles */}
          <div className="flex flex-wrap gap-2 mb-4">
            {([
              { k: "record", label: "🎙️ Record" },
              { k: "upload", label: "⬆️ Upload" },
              { k: "text", label: "✍️ Paste Text" },
            ] as const).map((btn) => (
              <button
                key={btn.k}
                type="button"
                onClick={() => setMode(btn.k)}
                className={`rounded-lg px-3 py-1.5 border ${
                  mode === btn.k ? "border-cyan-500 text-cyan-400" : "border-slate-700 text-slate-300"
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>

          {/* Record mode */}
          {mode === "record" && (
            <div className="space-y-4">
              {/* mic bar + time */}
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                  {!recording ? (
                    <button
                      type="button"
                      onClick={startRecording}
                      className="rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-5 py-3 font-semibold shadow hover:opacity-90"
                    >
                      Start Recording
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={stopRecording}
                      className="rounded-xl border border-red-500 px-5 py-3 font-semibold hover:bg-red-500/10"
                    >
                      Stop Recording
                    </button>
                  )}
                  <div className="text-sm text-slate-400">{recording ? "Recording…" : "Not recording"}</div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-sm text-slate-400 tabular-nums">{timeStr}</div>

                  {/* Auto-stop control */}
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span>Auto-stop</span>
                    <select
                      value={limitMode}
                      onChange={(e) => setLimitMode(e.target.value as any)}
                      className="rounded-md bg-slate-800 border border-slate-700 px-2 py-1 text-slate-200"
                    >
                      <option value="none">None</option>
                      <option value="60">1:00</option>
                      <option value="90">1:30</option>
                      <option value="120">2:00</option>
                      <option value="180">3:00</option>
                      <option value="300">5:00</option>
                      <option value="600">10:00</option>
                      <option value="900">15:00</option>
                      <option value="1200">20:00</option>
                      <option value="custom">Custom…</option>
                    </select>

                    {limitMode === "custom" && (
                      <label className="flex items-center gap-1">
                        <input
                          type="number"
                          min={1}
                          max={120}
                          value={customMinutes}
                          onChange={(e) => setCustomMinutes(Number(e.target.value))}
                          className="w-16 rounded-md bg-slate-800 border border-slate-700 px-2 py-1 text-slate-200"
                        />
                        <span>min</span>
                      </label>
                    )}
                  </div>
                </div>
              </div>

              {/* Mic meter */}
              <div className="h-3 w-full rounded-full bg-slate-800 overflow-hidden border border-slate-700">
                <div
                  className={`h-full transition-[width] duration-100 ${
                    level < 0.25 ? "bg-slate-500" : level < 0.6 ? "bg-cyan-500" : "bg-amber-400"
                  }`}
                  style={{ width: `${Math.min(100, Math.floor(level * 100))}%` }}
                />
              </div>

              {/* Selected file preview + controls */}
              {file && (
                <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-slate-300">
                      Selected: <span className="text-cyan-300">{file.name}</span>{" "}
                      <span className="text-slate-500">({Math.round(file.size / 1024)} KB)</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setFile(null)}
                        className="text-xs rounded-lg border border-slate-700 px-3 py-1.5 hover:border-slate-600"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  {previewUrl && (
                    <audio src={previewUrl} className="mt-3 w-full" controls preload="metadata" />
                  )}
                </div>
              )}

              <button
                onClick={onSubmit}
                className="rounded-xl bg-cyan-600 px-4 py-2 font-semibold hover:bg-cyan-500 disabled:opacity-60"
                disabled={loading || !file}
              >
                {loading ? "Analyzing…" : "Analyze Recording"}
              </button>
            </div>
          )}

          {/* Upload mode */}
          {mode === "upload" && (
            <form className="space-y-3" onSubmit={onSubmit}>
              {/* Dropzone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const f = e.dataTransfer?.files?.[0];
                  if (f && f.type.startsWith("audio/")) setFile(f);
                }}
                className="rounded-xl border border-dashed border-slate-700 p-6 text-center hover:border-cyan-500 transition"
              >
                <p className="text-slate-300">Drag & drop audio here, or choose a file</p>
                <p className="text-xs text-slate-500 mt-1">
                  Supported: any <code className="text-slate-400">audio/*</code>
                </p>
                <div className="mt-3">
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="block w-full text-sm text-slate-300 file:mr-4 file:rounded-md file:border-0 file:bg-slate-800 file:px-4 file:py-2 file:text-slate-200 hover:file:bg-slate-700"
                  />
                </div>
              </div>

              {file && (
                <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-slate-300">
                      Selected: <span className="text-cyan-300">{file.name}</span>{" "}
                      <span className="text-slate-500">({Math.round(file.size / 1024)} KB)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFile(null)}
                      className="text-xs rounded-lg border border-slate-700 px-3 py-1.5 hover:border-slate-600"
                    >
                      Remove
                    </button>
                  </div>
                  {previewUrl && <audio src={previewUrl} className="mt-3 w-full" controls preload="metadata" />}
                </div>
              )}

              <button
                type="submit"
                className="rounded-xl bg-cyan-600 px-4 py-2 font-semibold hover:bg-cyan-500 disabled:opacity-60"
                disabled={loading || !file}
              >
                {loading ? "Analyzing…" : "Analyze File"}
              </button>
            </form>
          )}

          {/* Text mode */}
          {mode === "text" && (
            <form className="space-y-3" onSubmit={onSubmit}>
              <div className="flex items-center justify-between">
                <label className="block text-sm text-slate-300">Transcript *</label>
                <div className="text-xs text-slate-500">
                  {text.trim().length} chars • {text.trim() ? text.trim().split(/\s+/).length : 0} words
                </div>
              </div>
              <textarea
                rows={8}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste or type the transcript here…"
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-4 py-3 outline-none focus:border-cyan-500"
              />
              <div className="flex flex-wrap gap-2 text-xs">
                {[
                  "Add more concrete examples.",
                  "Reduce filler words like 'um', 'you know'.",
                  "Make the conclusion more memorable.",
                  "Improve transitions between points.",
                ].map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setText((t) => (t ? t + "\n" + q : q))}
                    className="rounded-full border border-slate-700 px-3 py-1 hover:border-slate-600"
                    title="Append hint"
                  >
                    + {q}
                  </button>
                ))}
              </div>
              <button
                type="submit"
                className="rounded-xl bg-cyan-600 px-4 py-2 font-semibold hover:bg-cyan-500 disabled:opacity-60"
                disabled={loading || !text.trim()}
              >
                {loading ? "Analyzing…" : "Analyze Text"}
              </button>
            </form>
          )}

          {err && (
            <div className="mt-4 rounded-lg border border-red-600 bg-red-600/10 px-4 py-3 text-sm text-red-300">
              {err}
            </div>
          )}
        </div>

        {/* Results */}
        {feedback && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            {speechId != null && (
              <div className="mb-4 text-sm text-slate-400">
                Saved as <span className="text-cyan-300">#{speechId}</span>
              </div>
            )}

            <div className="flex flex-wrap gap-2 mb-5">
              {"opening" in (feedback || {}) && <ScoreChip label="Opening" value={getScore("opening")} />}
              <ScoreChip label="Content" value={getScore("content")} />
              <ScoreChip label="Delivery" value={getScore("delivery")} />
              <ScoreChip label="Grammar" value={getScore("grammar")} />
              <ScoreChip label="Overall" value={getScore("overall")} />
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {"opening" in (feedback || {}) && (
                <Card title="Opening" score={getScore("opening")}>{sectionToText(feedback?.opening)}</Card>
              )}
              <Card title="Content" score={getScore("content")}>{sectionToText(feedback?.content)}</Card>
              <Card title="Delivery" score={getScore("delivery")}>{sectionToText(feedback?.delivery)}</Card>
              <Card title="Grammar" score={getScore("grammar")}>{sectionToText(feedback?.grammar)}</Card>
            </div>

            <div className="mt-6">
              <Card title="Overall" score={getScore("overall")}>
                {sectionToText(feedback?.overall)}
                {Array.isArray(feedback?.suggestions) && feedback!.suggestions!.length > 0 && (
                  <div className="mt-3">
                    <h4 className="font-semibold mb-2">Suggestions</h4>
                    <ul className="list-disc list-inside text-slate-300">
                      {feedback!.suggestions!.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </Card>
            </div>

            {transcript && (
              <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                <h3 className="text-xl font-semibold mb-2">Transcript</h3>
                <div className="text-slate-200 whitespace-pre-wrap">{transcript}</div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

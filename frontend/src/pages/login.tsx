import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { login, getToken } from "@/utils/auth";

function toErrorMessage(e: any): string {
  // Axios error?
  const data = e?.response?.data;

  // 1) plain string
  if (typeof data === "string") return data;

  // 2) { detail: "..." }
  if (typeof data?.detail === "string") return data.detail;

  // 3) { detail: [ {msg, loc, ...}, ... ] }  (FastAPI/Pydantic)
  if (Array.isArray(data?.detail)) {
    const msgs = data.detail
      .map((d: any) => d?.msg || d?.detail || JSON.stringify(d))
      .filter(Boolean);
    if (msgs.length) return msgs.join(" • ");
  }

  // 4) direct array [{msg,...}]
  if (Array.isArray(data)) {
    const msgs = data.map((d: any) => d?.msg || d?.detail || JSON.stringify(d)).filter(Boolean);
    if (msgs.length) return msgs.join(" • ");
  }

  // 5) { msg: "..." } or {error:"..."}
  if (typeof data?.msg === "string") return data.msg;
  if (typeof data?.error === "string") return data.error;

  // 6) fallback to axios/message
  return e?.message || "Something went wrong. Please try again.";
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // If already logged in, go straight to dashboard
  useEffect(() => {
    if (getToken()) router.replace("/dashboard");
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!email || !password) return setErr("Email and password are required.");

    try {
      setLoading(true);
      await login(email.trim(), password);
      router.replace("/dashboard"); // ✅ navigate after success
    } catch (error: any) {
      setErr(toErrorMessage(error)); // ✅ ensure string
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-md p-8 shadow-xl">
        <h1 className="text-3xl font-extrabold text-center mb-2">
          Welcome back to <span className="text-cyan-400">OpenSpeak</span>
        </h1>
        <p className="text-center text-slate-300 mb-8">
          Log in to access your dashboard, analysis, and generator.
        </p>

        {err && (
          <div className="mb-4 rounded-lg border border-red-600 bg-red-600/10 px-4 py-3 text-sm text-red-300">
            {err}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm text-slate-300 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-4 py-3 outline-none focus:border-cyan-500"
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1">Password</label>
            <div className="relative">
              <input
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-4 py-3 pr-12 outline-none focus:border-cyan-500"
                placeholder="••••••••"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPwd((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-cyan-400 text-sm"
                aria-label="Toggle password visibility"
              >
                {showPwd ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-3 font-semibold shadow-md hover:opacity-90 disabled:opacity-60"
          >
            {loading ? "Logging in..." : "Log In"}
          </button>
        </form>

        <p className="mt-6 text-center text-slate-400 text-sm">
          Don’t have an account?{" "}
          <Link href="/signup" className="text-cyan-400 hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}

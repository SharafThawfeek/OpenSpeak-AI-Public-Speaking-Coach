import Link from "next/link";

export default function PublicNavBar() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/70 backdrop-blur">
      <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-lg font-extrabold tracking-tight">
          <span className="text-white">Open</span>
          <span className="text-cyan-400">Speak</span>
        </Link>

        <nav className="flex items-center gap-6 text-slate-300">
          <Link className="hover:text-cyan-400 transition" href="/#features">Features</Link>
          <Link className="hover:text-cyan-400 transition" href="/#how-it-works">How it works</Link>
          <Link className="hover:text-cyan-400 transition" href="/#contact">Contact</Link>

          <Link
            href="/login"
            className="rounded-lg border border-slate-700 px-3 py-1.5 hover:border-cyan-500 hover:text-cyan-400 transition"
          >
            Login
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 px-3 py-1.5 font-semibold shadow hover:opacity-90"
          >
            Sign Up
          </Link>
        </nav>
      </div>
    </header>
  );
}

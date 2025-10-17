// src/pages/index.tsx
import Head from "next/head";
import Link from "next/link";
import { motion } from "framer-motion";
import { useMemo } from "react";

export default function Home() {
  const features = useMemo(
    () => [
      {
        title: "🎯 AI-Powered Insights",
        desc:
          "Get instant analytics on tone, pace, fillers, clarity and more—powered by advanced speech analysis models.",
      },
      {
        title: "💬 Speech Generator",
        desc:
          "Turn ideas into polished speeches tailored to your audience, duration, and goal in seconds.",
      },
      {
        title: "🧠 Real-Time Coaching",
        desc:
          "Practice live and receive actionable feedback with strengths, weaknesses, and next-step tips.",
      },
    ],
    []
  );

  const faqs = useMemo(
    () => [
      {
        q: "Do I need an account to try it?",
        a: "You can chat with the AI coach from the floating 🤖 button without an account. To analyze recordings or save progress, you’ll need to sign up.",
      },
      {
        q: "What formats can I upload?",
        a: "Most common audio formats work (e.g., .mp3, .m4a, .wav, .webm). Record in-app or upload a file.",
      },
      {
        q: "Is my data private?",
        a: "Your recordings and results are private to your account. You can delete them anytime from History.",
      },
      {
        q: "Can I use it for interviews or pitches?",
        a: "Absolutely. Many users practice for interviews, demos, sales pitches, and conference talks.",
      },
    ],
    []
  );

  return (
    <>
      <Head>
        <title>OpenSpeak — AI Speech Coach</title>
        <meta
          name="description"
          content="Analyze your speaking, generate custom speeches, and get real-time coaching feedback with OpenSpeak."
        />
        <meta property="og:title" content="OpenSpeak — AI Speech Coach" />
        <meta
          property="og:description"
          content="Analyze your speaking, generate speeches, and improve fast with AI-powered feedback."
        />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://cdn-icons-png.flaticon.com/512/921/921071.png" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="canonical" href="/" />
        <script
          type="application/ld+json"
          // Simple structured data to help SEO
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "OpenSpeak",
              applicationCategory: "EducationApplication",
              operatingSystem: "Web",
              offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
            }),
          }}
        />
      </Head>

      <div className="bg-gray-950 text-white flex flex-col min-h-screen overflow-x-hidden">
        {/* Animated BG */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900 via-gray-900 to-black opacity-80 -z-10 animate-gradient" />

        {/* Hero */}
        <section className="flex flex-col md:flex-row items-center justify-between px-8 md:px-16 lg:px-32 pt-24 pb-16 md:pb-24 space-y-10 md:space-y-0">
          <motion.div
            className="flex-1 space-y-6"
            initial={{ opacity: 0, x: -60 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.9 }}
          >
            <div className="inline-flex items-center gap-2 text-xs px-3 py-1 rounded-full border border-slate-700 text-slate-300 bg-slate-900/50">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Now with live coaching tips
            </div>

            <h1 className="text-5xl md:text-7xl font-extrabold leading-tight bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              Speak Confidently.
              <br />
              <span className="text-white">Inspire Effortlessly. 🎤</span>
            </h1>

            <p className="text-gray-300 text-lg md:text-xl max-w-xl">
              OpenSpeak is your AI coach for public speaking—analyze your delivery, generate better
              scripts, and improve fast with targeted feedback.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/signup"
                className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:opacity-90 px-6 py-3 rounded-lg text-lg font-semibold shadow-md transition"
              >
                Get Started
              </Link>
              <Link
                href="/login"
                className="border border-gray-600 hover:bg-gray-800 px-6 py-3 rounded-lg text-lg font-semibold transition"
              >
                Login
              </Link>
              <button
                onClick={() => window.dispatchEvent(new Event("open-chat"))}
                className="sm:ml-2 bg-slate-800/70 hover:bg-slate-800 border border-slate-700 px-6 py-3 rounded-lg text-lg font-semibold transition"
              >
                Try Chat Now 🤖
              </button>
            </div>

            {/* Trust strip */}
            <div className="pt-4 text-slate-400 text-sm">
              Trusted by students, founders, sales teams, and aspiring speakers worldwide.
            </div>
          </motion.div>

          <motion.div
            className="flex-1 flex justify-center relative"
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.9 }}
          >
            <div className="absolute w-64 h-64 md:w-96 md:h-96 bg-blue-500/20 blur-3xl rounded-full -z-10 animate-pulse" />
            <img
              src="https://cdn-icons-png.flaticon.com/512/921/921071.png"
              alt="Public Speaking Illustration"
              className="w-72 md:w-96 drop-shadow-[0_0_25px_rgba(59,130,246,0.5)] hover:scale-105 transition-transform duration-300"
              loading="eager"
            />
          </motion.div>
        </section>

        <div className="h-1 w-full bg-gradient-to-r from-blue-600 via-cyan-400 to-transparent opacity-60" />

        {/* How it works */}
        <section className="px-8 md:px-16 lg:px-32 py-16">
          <h2 className="text-3xl font-bold text-blue-400 mb-8 text-center">How it works</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                step: "1",
                title: "Record or Upload",
                desc: "Use the in-browser recorder or upload an audio file of your talk or practice.",
              },
              {
                step: "2",
                title: "AI Analysis",
                desc: "Our models evaluate tone, pacing, clarity, grammar, and structure in seconds.",
              },
              {
                step: "3",
                title: "Actionable Feedback",
                desc: "Get scores, strengths/weaknesses, and concrete suggestions to improve.",
              },
            ].map((s) => (
              <motion.div
                key={s.step}
                className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6"
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                <div className="text-5xl font-black text-cyan-400 mb-2">{s.step}</div>
                <h3 className="text-xl font-semibold mb-1">{s.title}</h3>
                <p className="text-slate-300">{s.desc}</p>
              </motion.div>
            ))}
          </div>

          <div className="mt-8 text-center">
            <Link
              href="/analyze"
              className="inline-block rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-6 py-3 font-semibold shadow hover:opacity-90"
            >
              Start analyzing your speech →
            </Link>
          </div>
        </section>

        {/* Features */}
        <section className="px-8 md:px-16 lg:px-32 py-16 text-center">
          <h2 className="text-3xl font-bold text-blue-400 mb-10">Your AI Coach Includes</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                className="bg-white/5 backdrop-blur-md p-8 rounded-2xl border border-gray-700 hover:border-blue-500 transition-all duration-300 hover:shadow-[0_0_20px_rgba(59,130,246,0.3)]"
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <h3 className="text-2xl font-semibold text-blue-300 mb-3">{feature.title}</h3>
                <p className="text-gray-300">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Social proof / metrics */}
        <section className="px-8 md:px-16 lg:px-32 py-12">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 grid gap-6 md:grid-cols-4 text-center">
            {[
              { label: "Avg. improvement in 2 weeks", value: "28%" },
              { label: "Practices completed", value: "10k+" },
              { label: "Global user rating", value: "4.8/5" },
              { label: "Enterprises piloting", value: "30+" },
            ].map((s) => (
              <div key={s.label}>
                <div className="text-4xl font-extrabold text-cyan-400">{s.value}</div>
                <div className="text-slate-400 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Testimonials */}
        <section className="bg-gray-900 py-16 text-center">
          <h2 className="text-3xl font-bold text-blue-400 mb-10">
            Loved by Speakers Everywhere 🌍
          </h2>
          <div className="flex flex-col md:flex-row justify-center gap-8 px-8">
            {[
              {
                name: "Sarah M.",
                text: "“OpenSpeak completely changed how I prepare for speeches. It’s like having a personal coach 24/7.”",
              },
              {
                name: "James L.",
                text: "“The feedback feels human. I improved my stage presence after just a week.”",
              },
              {
                name: "Priya K.",
                text: "“I used to freeze up before speaking. Now I walk on stage confident and ready.”",
              },
            ].map((review, i) => (
              <motion.div
                key={i}
                className="bg-gray-800/60 backdrop-blur-md p-6 rounded-xl border border-gray-700 max-w-sm mx-auto md:mx-0 hover:scale-105 transition-transform"
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <p className="italic text-gray-300 mb-4">{review.text}</p>
                <h4 className="text-blue-400 font-semibold">{review.name}</h4>
              </motion.div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="px-8 md:px-16 lg:px-32 py-16">
          <h2 className="text-3xl font-bold text-blue-400 mb-6 text-center">FAQ</h2>
          <div className="mx-auto max-w-3xl divide-y divide-slate-800 rounded-2xl border border-slate-800 bg-slate-900/60">
            {faqs.map((f, idx) => (
              <details
                key={idx}
                className="group px-6 py-4 open:bg-slate-900/70"
              >
                <summary className="cursor-pointer list-none font-semibold text-slate-200 flex items-center justify-between">
                  {f.q}
                  <span className="ml-4 text-slate-400 group-open:rotate-180 transition-transform">
                    ▾
                  </span>
                </summary>
                <p className="mt-2 text-slate-300">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="bg-gradient-to-r from-blue-700 to-cyan-600 py-16 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Ready to Transform Your Speaking Skills?
          </h2>
          <div className="flex items-center justify-center gap-3">
            <Link
              href="/signup"
              className="bg-white text-blue-700 px-8 py-3 rounded-lg font-semibold text-lg hover:bg-gray-200 transition"
            >
              Join OpenSpeak Today
            </Link>
            <Link
              href="/analyze"
              className="border border-white/70 text-white px-8 py-3 rounded-lg font-semibold text-lg hover:bg-white/10 transition"
            >
              Analyze a Sample →
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}

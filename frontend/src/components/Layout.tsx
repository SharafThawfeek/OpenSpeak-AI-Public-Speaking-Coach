// ...existing imports
import dynamic from "next/dynamic";

// Avoid SSR issues with window/MediaRecorder
const ChatbotWidget = dynamic(() => import("@/components/ChatbotWidget"), {
  ssr: false,
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* your sticky nav header here */}
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/70 backdrop-blur">
        {/* ...nav content... */}
      </header>

      {children}

      {/* 👇 Floating chatbot (renders on every page) */}
      <ChatbotWidget />
    </div>
  );
}

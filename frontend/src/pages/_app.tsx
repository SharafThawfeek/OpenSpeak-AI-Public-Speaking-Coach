// src/pages/_app.tsx
import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import NavBar from "@/components/NavBar";
import PublicNavBar from "@/components/PublicNavBar";
import ChatbotWidget from "@/components/ChatbotWidget";

export default function App({ Component, pageProps }: AppProps) {
  const { pathname } = useRouter();

  // Pages that should use the public/marketing navbar
  const publicRoutes = ["/", "/login", "/signup"];
  const usePublicNav = publicRoutes.includes(pathname);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {usePublicNav ? <PublicNavBar /> : <NavBar />}
      <Component {...pageProps} />
      <ChatbotWidget />
    </div>
  );
}

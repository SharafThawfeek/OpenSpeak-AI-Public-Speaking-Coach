"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, MessageCircle, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api } from "@/utils/api";
import { getToken } from "@/utils/auth";

type ChatMsg = { role: "user" | "assistant"; content: string };

export default function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      role: "assistant",
      content:
        "👋 **Hi there!** I’m your **AI Speaking Coach**.\n\nAsk me about analyzing your speech, tracking progress, or getting quick coaching tips!",
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // stable client session id
  const sessionId = useMemo(() => {
    let sid = "";
    if (typeof window !== "undefined") {
      sid = localStorage.getItem("openspeak_chat_session") || "";
      if (!sid) {
        sid = crypto.randomUUID();
        localStorage.setItem("openspeak_chat_session", sid);
      }
    }
    return sid;
  }, []);

  // auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // allow other UI to open the chat: window.dispatchEvent(new Event("open-chat"))
  useEffect(() => {
    const open = () => setIsOpen(true);
    window.addEventListener("open-chat", open as any);
    return () => window.removeEventListener("open-chat", open as any);
  }, []);

  const handleSend = async () => {
    const content = input.trim();
    if (!content) return;

    setMessages((m) => [...m, { role: "user", content }]);
    setInput("");
    setIsTyping(true);

    try {
      // Uses your configured axios instance (adds Authorization header if token exists)
      const { data } = await api.post("/chat", {
        message: content,
        session_id: sessionId,
      });

      const answer =
        data?.answer ||
        "Sorry, I couldn’t process that. Try rephrasing your question.";
      setMessages((m) => [...m, { role: "assistant", content: answer }]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content:
            "⚠️ Error: Unable to reach the assistant right now. Please try again.",
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // If you ever want to show login gating in the header
  const token = getToken?.();
  const userHint = token ? "" : " (guest)";

  return (
    <>
      {/* FAB */}
      {!isOpen && (
        <motion.button
          onClick={() => setIsOpen(true)}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          className="fixed bottom-6 right-6 bg-gradient-to-r from-indigo-500 to-purple-600 text-white p-4 rounded-full shadow-lg hover:shadow-2xl z-[60]"
          aria-label="Open chat"
        >
          <MessageCircle className="w-6 h-6" />
        </motion.button>
      )}

      {/* Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            transition={{ duration: 0.25 }}
            className="fixed bottom-6 right-6 w-[22rem] max-h-[80vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-800 flex flex-col overflow-hidden z-[60]"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white p-4 flex justify-between items-center">
              <h2 className="text-sm font-semibold">
                AI Speaking Coach{userHint} 🤖
              </h2>
              <button
                aria-label="Close chat"
                onClick={() => setIsOpen(false)}
                className="opacity-90 hover:opacity-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white dark:bg-slate-900">
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`p-3 rounded-2xl max-w-[80%] text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-indigo-500 text-white rounded-br-none"
                        : "bg-gray-100 text-gray-800 rounded-bl-none dark:bg-slate-800 dark:text-slate-100"
                    }`}
                  >
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: (props) => <p className="mb-1" {...props} />,
                        strong: (props) => (
                          <strong
                            className="font-semibold text-indigo-600 dark:text-indigo-400"
                            {...props}
                          />
                        ),
                        ul: (props) => (
                          <ul className="list-disc list-inside mb-1" {...props} />
                        ),
                        li: (props) => <li className="ml-2" {...props} />,
                        a: (props) => (
                          <a
                            {...props}
                            className="underline text-indigo-600 dark:text-indigo-400"
                            target="_blank"
                            rel="noreferrer"
                          />
                        ),
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                </motion.div>
              ))}

              {isTyping && (
                <div className="text-gray-400 text-xs italic animate-pulse">
                  AI is typing...
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-gray-200 dark:border-slate-800 p-3 flex items-center gap-2 bg-white dark:bg-slate-900">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Type your message…"
                rows={1}
                className="flex-1 resize-none p-2 text-sm border border-gray-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white dark:bg-slate-950 text-gray-800 dark:text-slate-100"
              />
              <button
                onClick={handleSend}
                className="bg-indigo-500 hover:bg-indigo-600 text-white p-2 rounded-lg transition"
                aria-label="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

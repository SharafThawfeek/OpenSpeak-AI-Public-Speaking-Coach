import pypandoc

text = """
# OpenSpeak – AI Speaking Coach

OpenSpeak is a next-generation AI-powered public speaking assistant designed to help users improve their speech performance, delivery, and confidence.

Built using FastAPI (backend), Next.js (frontend), and LangChain + Groq LLMs, it provides the following key features:

🎤 **Live speech analysis** – Record or stream your voice in real time  
🔍 **Feedback scoring** – Grammar, clarity, confidence, and tone  
🤖 **AI chatbot** – Personalized guidance via RAG (context-aware) assistant  
🧱 **Speech generator** – Generates motivational speeches or practice prompts  
💾 **User authentication & history tracking** – Securely stores your progress  

---

## ⚙️ Tech Stack

- **Frontend:** Next.js + Tailwind CSS  
- **Backend:** FastAPI + SQLAlchemy  
- **Database:** PostgreSQL  
- **AI Models:** Groq Llama3 / HuggingFace Embeddings  
- **Authentication:** JWT + bcrypt  
- **Vector Store:** ChromaDB (RAG Context Memory)  

---

## 🚀 Features

- ✅ Real-time speech analysis  
- ✅ Upload MP3 and get AI feedback  
- ✅ Personalized AI chat coaching  
- ✅ Visual analytics dashboard  
- ✅ Secure login & user profile  
- ✅ Speech history and tracking  

---

## 🧩 Architecture

```
Frontend (Next.js)
│
├── /analyze → Speech recording & upload
├── /chat → RAG-based AI assistant
├── /profile → JWT-secured user info
│
Backend (FastAPI)
├── /generate-speech
├── /analyze-speech
├── /chat (LangChain + Groq)
├── /auth (JWT + bcrypt)
│
Database (PostgreSQL + ChromaDB)

```

---

## 🌍 Mission

To make AI-driven communication coaching accessible to everyone — helping students, professionals, and leaders speak with clarity, confidence, and impact.
"""

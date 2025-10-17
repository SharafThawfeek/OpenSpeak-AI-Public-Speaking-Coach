# 🗣️ OpenSpeak – AI Public Speaking Coach

**OpenSpeak** is a next-generation **AI-powered public speaking assistant** designed to help users improve their speech performance, delivery, and confidence.  
It combines real-time feedback, AI coaching, and intelligent speech generation using a multi-agent architecture.

---

## 🧩 Project Overview

This project demonstrates an **Agentic AI System** that integrates multiple intelligent modules to enhance public speaking analysis and coaching.

Built as part of **IT3041 – Information Retrieval and Web Analytics**, it showcases advanced applications of NLP, speech processing, and explainable AI.

---

## 🤖 Key Features

🎤 **Live Speech Analysis** – Record or stream your voice in real time  
🔍 **Feedback Scoring** – Evaluate grammar, clarity, confidence, and tone  
💬 **AI Chatbot Coach** – Context-aware RAG assistant for personalized advice  
🧱 **Speech Generator** – Creates motivational speeches or practice prompts  
💾 **User Authentication & History Tracking** – Secure progress storage  
🧠 **Explainable AI Module** – Provides transparent and interpretable insights  

---

## ⚙️ Tech Stack

| Layer | Technologies |
|-------|---------------|
| **Frontend** | Next.js, Tailwind CSS |
| **Backend** | FastAPI, SQLAlchemy |
| **Database** | PostgreSQL |
| **AI Models** | Groq Llama3, HuggingFace Embeddings |
| **Vector Store** | ChromaDB (RAG Memory) |
| **Authentication** | JWT, bcrypt |
| **IR & NLP Tools** | LangChain, Groq API |

---

## 🧠 System Architecture

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
│
Agents:
├── content_agent.py → Evaluates structure & coherence
├── delivery_agent.py → Analyzes tone, pace, confidence
├── grammar_agent.py → Corrects and scores language
│
Orchestrator:
└── orchestrator.py → Combines agent scores & generates feedback
```


---

## 🧮 Multi-Agent System

| Agent | Function |
|--------|-----------|
| **Content Agent** | Evaluates key points, logical flow, and coherence |
| **Delivery Agent** | Measures tone, pace, emotion, and confidence |
| **Grammar Agent** | Detects and explains grammatical issues |
| **Orchestrator** | Integrates agent outputs to provide holistic feedback |
| **Speech Generator** | Uses LLMs to create practice speeches |
| **Chatbot (RAG)** | Retrieves context-relevant public speaking tips |

---

## 🔐 Security & Responsible AI

- JWT-based authentication  
- bcrypt password hashing  
- Input validation and sanitization  
- Fairness and transparency in feedback  
- No storage of user voice data without consent  

---

---

## ⚙️ Installation & Setup

### 1️⃣ Clone the repository
```bash
git clone https://github.com/SharafThawfeek/OpenSpeak-AI-Public-Speaking-Coach.git
cd OpenSpeak-AI-Public-Speaking-Coach

2️⃣ Set up a virtual environment
python -m venv venv
source venv/bin/activate   # For macOS/Linux
venv\Scripts\activate      # For Windows

3️⃣ Install dependencies
pip install -r requirements.txt

4️⃣ Set environment 
GROQ_API_KEY=your_api_key_here
DATABASE_URL=postgresql://user:password@localhost/openspeak
JWT_SECRET=your_secret_key

5️⃣ Run the FastAPI server
uvicorn src.server:app --reload

```

👥 Contributors

| Name                         | Role          | Responsibilities                              |
| ---------------------------- | ------------- | --------------------------------------------- |
| **Sharaf Thawfeek (Leader)** | System Design | LLM integration, orchestration                |
| **Ushna Uwais**              | NLP Developer | Preprocessing, evaluation                     |
| **Anas Ahamed**              | IR & Security | Knowledge base, encryption, commercialization |


🌍 Mission

“To make AI-driven communication coaching accessible to everyone — helping students, professionals, and leaders speak with clarity, confidence, and impact.”
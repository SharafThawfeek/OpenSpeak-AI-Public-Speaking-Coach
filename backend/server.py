from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Request, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
from dotenv import load_dotenv
from groq import Groq
import os, tempfile

import crud, models
from database import SessionLocal, engine
from auth import create_access_token, get_current_user
from crud import verify_password
from agents.orchestrator import orchestrate_analysis
from agents.chatbot import create_chatbot
from agents.speech_generator import create_speech_generator, estimate_word_count

# ------------------------------------------------
# 🌍 Setup
# ------------------------------------------------
load_dotenv()
models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="OpenSpeak AI Coach API",
    description="🚀 Public Speaking Coach API built with FastAPI + LangChain + Groq",
    version="3.1.0"
)

# ------------------------------------------------
# 🌐 CORS Setup
# ------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Update this in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------------------------------------
# 🗄️ Database Dependency
# ------------------------------------------------
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ------------------------------------------------
# 📦 Schemas
# ------------------------------------------------
class UserSignup(BaseModel):
    username: str
    email: str
    password: str


class SpeechInput(BaseModel):
    transcript: str


class ChatRequest(BaseModel):
    session_id: str
    message: str


# ------------------------------------------------
# 🧠 Groq Whisper Setup
# ------------------------------------------------
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

# ------------------------------------------------
# 🔐 Simple Bearer Auth Setup
# ------------------------------------------------
security = HTTPBearer()

# ------------------------------------------------
# 🧱 ROUTES
# ------------------------------------------------

# ✅ Signup (clean Swagger form)
@app.post("/signup", summary="Register a new user", tags=["Authentication"])
def signup(
    username: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db),
):
    existing = crud.get_user_by_email(db, email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = crud.create_user(db, username, email, password)
    return {
        "message": "Signup successful!",
        "user": {"id": user.id, "username": user.username, "email": user.email},
    }


# ✅ Login (clean form fields)
@app.post("/login", summary="Authenticate and get a JWT token", tags=["Authentication"])
def login(
    email: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db),
):
    user = crud.get_user_by_email(db, email)
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(data={"sub": user.email})
    return {"access_token": token, "token_type": "bearer"}


# ✅ Test Authorization
@app.get("/test-auth", summary="Test JWT Bearer authorization", tags=["Authentication"])
def test_auth(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Simple route to test if JWT works in Swagger."""
    token = credentials.credentials
    return {"message": "Token received successfully ✅", "token": token}


# ✅ Analyze Speech
@app.post("/analyze", summary="Analyze transcript text", tags=["Speech Analysis"])
def analyze(
    speech: SpeechInput,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    db_user = crud.get_user_by_email(db, current_user)
    if not db_user:
        raise HTTPException(status_code=401, detail="User not found")

    feedback = orchestrate_analysis(speech.transcript)
    speech_id = crud.save_speech(db, db_user.id, speech.transcript, feedback)
    return {"speech_id": speech_id, "feedback": feedback}


# ✅ Analyze Recorded Audio
@app.post("/analyze_audio", summary="Analyze uploaded speech audio", tags=["Speech Analysis"])
async def analyze_audio(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    db_user = crud.get_user_by_email(db, current_user)
    if not db_user:
        raise HTTPException(status_code=401, detail="User not found")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    try:
        with open(tmp_path, "rb") as audio_file:
            result = groq_client.audio.transcriptions.create(
                file=audio_file, model="whisper-large-v3"
            )
        transcript = result.text.strip()
    finally:
        os.remove(tmp_path)

    feedback = orchestrate_analysis(transcript)
    speech_id = crud.save_speech(db, db_user.id, transcript, feedback)
    return {"speech_id": speech_id, "transcript": transcript, "feedback": feedback}


# ✅ User History
@app.get("/history", summary="Get user’s past sessions", tags=["User Data"])
def get_history(db: Session = Depends(get_db), current_user: str = Depends(get_current_user)):
    db_user = crud.get_user_by_email(db, current_user)
    speeches = crud.get_user_speeches(db, db_user.id)
    return {"user": db_user.username, "speeches": speeches}


# ✅ Analytics
@app.get("/analytics", summary="Get user analytics", tags=["User Data"])
def analytics(db: Session = Depends(get_db), current_user: str = Depends(get_current_user)):
    db_user = crud.get_user_by_email(db, current_user)
    return crud.get_user_analytics(db, db_user.id)


# ✅ Progress
@app.get("/progress", summary="View progress over time", tags=["User Data"])
def progress(db: Session = Depends(get_db), current_user: str = Depends(get_current_user)):
    db_user = crud.get_user_by_email(db, current_user)
    data = crud.get_progress_over_time(db, db_user.id)
    return {"user": db_user.username, "progress": data}


# ✅ Chatbot
chatbot = create_chatbot()

@app.post("/chat", summary="Chat with AI coach", tags=["Chatbot"])
async def chat(request: ChatRequest):
    try:
        response = chatbot.invoke(
            {"input": request.message},
            config={"configurable": {"session_id": request.session_id}},
        )
        return {"answer": response.get("answer", "⚠️ No response from AI.")}
    except Exception as e:
        return {"error": str(e)}


# ✅ Speech Generator
speech_llm = create_speech_generator()

@app.post("/generate-speech", summary="Generate an AI speech", tags=["Speech Generator"])
async def generate_speech(request: Request):
    data = await request.json()
    user_input = data.get("input", "")
    session_id = data.get("session_id", "default")

    if not user_input:
        raise HTTPException(status_code=400, detail="No input provided.")

    target_words = estimate_word_count(user_input)
    user_input += f" (Please write approximately {target_words} words.)"

    response = speech_llm.invoke(
        {"input": user_input},
        config={"configurable": {"session_id": session_id}},
    )

    answer = (
        response.get("answer")
        if isinstance(response, dict)
        else getattr(response, "content", str(response))
    )
    return {"answer": answer.strip()}

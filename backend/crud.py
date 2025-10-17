import json
import bcrypt
from sqlalchemy.orm import Session
from sqlalchemy import func
from models import User, Speech, Feedback


# ==========================================================
# 🧍 USER FUNCTIONS
# ==========================================================
def get_user_by_email(db: Session, email: str):
    """Fetch a user by email."""
    return db.query(User).filter(User.email == email).first()


def create_user(db: Session, username: str, email: str, password: str):
    """Create a new user with a hashed password."""
    hashed_pw = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    user = User(username=username, email=email, password_hash=hashed_pw)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Check if a given password matches the stored hash."""
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


# ==========================================================
# 🎙 SPEECH & FEEDBACK MANAGEMENT
# ==========================================================
def save_speech(db: Session, user_id: int, transcript: str, feedback: dict):
    """Save a user's speech and its AI feedback into the database."""

    # 1️⃣ Save Speech
    new_speech = Speech(user_id=user_id, transcript=transcript)
    db.add(new_speech)
    db.commit()
    db.refresh(new_speech)

    # 2️⃣ Helper to safely serialize nested data
    def safe_json(value):
        if isinstance(value, (dict, list)):
            return json.dumps(value, ensure_ascii=False)
        return value

    # 3️⃣ Save Feedback
    new_feedback = Feedback(
        opening=safe_json(feedback.get("opening")),
        content=safe_json(feedback.get("content")),
        delivery=safe_json(feedback.get("delivery")),
        grammar=safe_json(feedback.get("grammar")),
        overall=safe_json(feedback.get("overall")),
        suggestions=", ".join(feedback.get("suggestions", [])),
        score_opening=feedback.get("score_opening"),
        score_content=feedback.get("score_content"),
        score_delivery=feedback.get("score_delivery"),
        score_grammar=feedback.get("score_grammar"),
        score_overall=feedback.get("score_overall"),
        speech_id=new_speech.id,
    )

    db.add(new_feedback)
    db.commit()
    db.refresh(new_feedback)

    return new_speech.id


# ==========================================================
# 📜 HISTORY FETCHING
# ==========================================================
def get_user_speeches(db: Session, user_id: int):
    """Fetch all speeches for a user (latest first) with their feedback."""
    speeches = (
        db.query(Speech)
        .filter(Speech.user_id == user_id)
        .order_by(Speech.created_at.desc())
        .all()
    )

    def try_json(value):
        """Convert JSON string back into dict/list if applicable."""
        if not value:
            return None
        try:
            if isinstance(value, str) and value.strip().startswith(("{", "[")):
                return json.loads(value)
            return value
        except json.JSONDecodeError:
            return value

    result = []
    for s in speeches:
        fb = s.feedback
        result.append({
            "id": s.id,
            "transcript": s.transcript,
            "created_at": s.created_at,
            "feedback": {
                "opening": try_json(fb.opening) if fb else None,
                "content": try_json(fb.content) if fb else None,
                "delivery": try_json(fb.delivery) if fb else None,
                "grammar": try_json(fb.grammar) if fb else None,
                "overall": try_json(fb.overall) if fb else None,
                "suggestions": fb.suggestions.split(", ") if fb and fb.suggestions else [],
                "scores": {
                    "opening": fb.score_opening if fb else None,
                    "content": fb.score_content if fb else None,
                    "delivery": fb.score_delivery if fb else None,
                    "grammar": fb.score_grammar if fb else None,
                    "overall": fb.score_overall if fb else None,
                } if fb else None,
            } if fb else None,
        })
    return result


# ==========================================================
# 📊 ANALYTICS FUNCTIONS
# ==========================================================
def get_user_analytics(db: Session, user_id: int):
    """Return average scores and total sessions for analytics."""
    result = (
        db.query(
            func.avg(Feedback.score_opening).label("avg_opening"),
            func.avg(Feedback.score_content).label("avg_content"),
            func.avg(Feedback.score_delivery).label("avg_delivery"),
            func.avg(Feedback.score_grammar).label("avg_grammar"),
            func.avg(Feedback.score_overall).label("avg_overall"),
            func.count(Speech.id).label("total_speeches"),
        )
        .join(Speech, Feedback.speech_id == Speech.id)
        .filter(Speech.user_id == user_id)
        .first()
    )

    if not result:
        return {
            "avg_opening": 0,
            "avg_content": 0,
            "avg_delivery": 0,
            "avg_grammar": 0,
            "avg_overall": 0,
            "total_speeches": 0,
        }

    return {
        "avg_opening": round(result.avg_opening or 0, 2),
        "avg_content": round(result.avg_content or 0, 2),
        "avg_delivery": round(result.avg_delivery or 0, 2),
        "avg_grammar": round(result.avg_grammar or 0, 2),
        "avg_overall": round(result.avg_overall or 0, 2),
        "total_speeches": result.total_speeches or 0,
    }


# ==========================================================
# 📈 PROGRESS OVER TIME
# ==========================================================
def get_progress_over_time(db: Session, user_id: int):
    """Return chronological score data for progress charts."""
    speeches = (
        db.query(Speech)
        .filter(Speech.user_id == user_id)
        .order_by(Speech.created_at.asc())
        .all()
    )

    progress = []
    for s in speeches:
        fb = s.feedback
        if not fb:
            continue
        progress.append({
            "speech_id": s.id,
            "date": s.created_at,
            "score_opening": fb.score_opening,
            "score_content": fb.score_content,
            "score_delivery": fb.score_delivery,
            "score_grammar": fb.score_grammar,
            "score_overall": fb.score_overall,
        })
    return progress
